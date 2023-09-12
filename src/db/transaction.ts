/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as pg from 'pg';
import { isDatabaseError } from './pgErrors';
import { wait } from './utils';
import { sql, raw } from './core';
import { getConfig } from './config';
import type { Queryable } from './core';


export enum IsolationLevel {
  // these are the only meaningful values in Postgres:
  // see https://www.postgresql.org/docs/11/sql-set-transaction.html
  Serializable = "SERIALIZABLE",
  RepeatableRead = "REPEATABLE READ",
  ReadCommitted = "READ COMMITTED",
  SerializableRO = "SERIALIZABLE, READ ONLY",
  RepeatableReadRO = "REPEATABLE READ, READ ONLY",
  ReadCommittedRO = "READ COMMITTED, READ ONLY",
  SerializableRODeferrable = "SERIALIZABLE, READ ONLY, DEFERRABLE"
}

export type IsolationSatisfying<T extends IsolationLevel> = {
  [IsolationLevel.Serializable]: IsolationLevel.Serializable;
  [IsolationLevel.RepeatableRead]: IsolationSatisfying<IsolationLevel.Serializable> | IsolationLevel.RepeatableRead;
  [IsolationLevel.ReadCommitted]: IsolationSatisfying<IsolationLevel.RepeatableRead> | IsolationLevel.ReadCommitted;
  [IsolationLevel.SerializableRO]: IsolationSatisfying<IsolationLevel.Serializable> | IsolationLevel.SerializableRO;
  [IsolationLevel.RepeatableReadRO]: IsolationSatisfying<IsolationLevel.SerializableRO> | IsolationSatisfying<IsolationLevel.RepeatableRead> | IsolationLevel.RepeatableReadRO;
  [IsolationLevel.ReadCommittedRO]: IsolationSatisfying<IsolationLevel.RepeatableReadRO> | IsolationSatisfying<IsolationLevel.ReadCommitted> | IsolationLevel.ReadCommittedRO;
  [IsolationLevel.SerializableRODeferrable]: IsolationSatisfying<IsolationLevel.SerializableRO> | IsolationLevel.SerializableRODeferrable;
}[T];

export interface TxnClient<T extends IsolationLevel> extends pg.PoolClient {
  _zapatos?: {
    isolationLevel: T;
    txnId: number;
  };
}

export type TxnClientForSerializable = TxnClient<IsolationSatisfying<IsolationLevel.Serializable>>;
export type TxnClientForRepeatableRead = TxnClient<IsolationSatisfying<IsolationLevel.RepeatableRead>>;
export type TxnClientForReadCommitted = TxnClient<IsolationSatisfying<IsolationLevel.ReadCommitted>>;
export type TxnClientForSerializableRO = TxnClient<IsolationSatisfying<IsolationLevel.SerializableRO>>;
export type TxnClientForRepeatableReadRO = TxnClient<IsolationSatisfying<IsolationLevel.RepeatableReadRO>>;
export type TxnClientForReadCommittedRO = TxnClient<IsolationSatisfying<IsolationLevel.ReadCommittedRO>>;
export type TxnClientForSerializableRODeferrable = TxnClient<IsolationSatisfying<IsolationLevel.SerializableRODeferrable>>;


function typeofQueryable(queryable: Queryable) {
  if (queryable instanceof pg.Pool) return 'pool';
  if (queryable instanceof pg.Client) return 'client';
  if (pg.native !== null && queryable instanceof pg.native.Pool) return 'pool';
  if (pg.native !== null && queryable instanceof pg.native.Client) return 'client';

  // for pg < 8, and sometimes in 8.x for reasons that aren't clear, all the
  // instanceof checks fail: then we resort to testing for the private variable
  // `_connected`, which is defined (as a boolean) on clients (pure JS and
  // native) but not on pools

  if ((queryable as any)._connected === undefined) return 'pool';
  return 'client';
}

let txnSeq = 0;

/**
 * Provide a database client to the callback, whose queries are then wrapped in
 * a database transaction. The transaction is committed, retried, or rolled back
 * as appropriate.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param isolationLevel The desired isolation level (e.g.
 * `IsolationLevel.Serializable`)
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function transaction<T, M extends IsolationLevel>(
  txnClientOrQueryable: Queryable | TxnClient<IsolationSatisfying<M>>,
  isolationLevel: M,
  callback: (client: TxnClient<IsolationSatisfying<M>>) => Promise<T>
): Promise<T> {

  if (Object.prototype.hasOwnProperty.call(txnClientOrQueryable, '_zapatos')) {
    // if txnClientOrQueryable is a TxnClient, just pass it through
    return callback(txnClientOrQueryable as TxnClient<IsolationSatisfying<M>>);
  }

  if (txnSeq >= Number.MAX_SAFE_INTEGER - 1) txnSeq = 0;  // wrap around

  const
    txnId = txnSeq++,
    clientIsOurs = typeofQueryable(txnClientOrQueryable) === 'pool',
    txnClient = (clientIsOurs ? await txnClientOrQueryable.connect() : txnClientOrQueryable) as TxnClient<M>;

  txnClient._zapatos = { isolationLevel, txnId };

  const
    config = getConfig(),
    { transactionListener } = config,
    maxAttempts = config.transactionAttemptsMax,
    { minMs, maxMs } = config.transactionRetryDelay;

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        if (attempt > 1 && transactionListener) transactionListener(`Retrying transaction, attempt ${attempt} of ${maxAttempts}`, txnId);

        await sql`START TRANSACTION ISOLATION LEVEL ${raw(isolationLevel)}`.run(txnClient);
        const result = await callback(txnClient as TxnClient<IsolationSatisfying<M>>);
        await sql`COMMIT`.run(txnClient);

        return result;

      } catch (err: any) {
        await sql`ROLLBACK`.run(txnClient);

        // on trapping the following two rollback error codes, see:
        // https://www.postgresql.org/message-id/1368066680.60649.YahooMailNeo@web162902.mail.bf1.yahoo.com
        // this is also a good read:
        // https://www.enterprisedb.com/blog/serializable-postgresql-11-and-beyond

        if (isDatabaseError(err, "TransactionRollback_SerializationFailure", "TransactionRollback_DeadlockDetected")) {
          if (attempt < maxAttempts) {
            const delayBeforeRetry = Math.round(minMs + (maxMs - minMs) * Math.random());
            if (transactionListener) transactionListener(`Transaction rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, retrying in ${delayBeforeRetry}ms`, txnId);
            await wait(delayBeforeRetry);

          } else {
            if (transactionListener) transactionListener(`Transaction rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, giving up`, txnId);
            throw err;
          }

        } else {
          throw err;
        }
      }
    }

  } finally {
    delete txnClient._zapatos;
    if (clientIsOurs) txnClient.release();
  }
}

/**
 * Shortcut for `transaction` with isolation level `Serializable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializable<T>(txnClientOrQueryable: Queryable | TxnClientForSerializable, callback: (client: TxnClientForSerializable) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.Serializable, callback);
}
/**
 * Shortcut for `transaction` with isolation level `RepeatableRead`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function repeatableRead<T>(txnClientOrQueryable: Queryable | TxnClientForRepeatableRead, callback: (client: TxnClientForRepeatableRead) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.RepeatableRead, callback);
}
/**
 * Shortcut for `transaction` with isolation level `ReadCommitted`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function readCommitted<T>(txnClientOrQueryable: Queryable | TxnClientForReadCommitted, callback: (client: TxnClientForReadCommitted) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.ReadCommitted, callback);
}
/**
 * Shortcut for `transaction` with isolation level `SerializableRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializableRO<T>(txnClientOrQueryable: Queryable | TxnClientForSerializableRO, callback: (client: TxnClientForSerializableRO) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.SerializableRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `RepeatableReadRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function repeatableReadRO<T>(txnClientOrQueryable: Queryable | TxnClientForRepeatableReadRO, callback: (client: TxnClientForRepeatableReadRO) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.RepeatableReadRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `ReadCommittedRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function readCommittedRO<T>(txnClientOrQueryable: Queryable | TxnClientForReadCommittedRO, callback: (client: TxnClientForReadCommittedRO) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.ReadCommittedRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `SerializableRODeferrable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializableRODeferrable<T>(txnClientOrQueryable: Queryable | TxnClientForSerializableRODeferrable, callback: (client: TxnClientForSerializableRODeferrable) => Promise<T>) {
  return transaction(txnClientOrQueryable, IsolationLevel.SerializableRODeferrable, callback);
}
