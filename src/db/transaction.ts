/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as pg from 'pg';
import { isDatabaseError } from './pgErrors';
import { wait } from './utils';
import { sql, raw } from './core';
import { getConfig } from "./config";


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

let txnSeq = 0;

/**
 * Provide a database client to the callback, whose queries are then wrapped in 
 * a database transaction. The transaction is committed, retried, or rolled back
 * as appropriate. 
 * @param txnClientOrPool The `pg.Pool` from which to check out the database
 * client or an appropriate transaction client to be passed through
 * @param isolationLevel The desired isolation level (e.g.
 * `IsolationLevel.Serializable`)
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function transaction<T, M extends IsolationLevel>(
  txnClientOrPool: pg.Pool | TxnClient<IsolationSatisfying<M>>,
  isolationLevel: M,
  callback: (client: TxnClient<IsolationSatisfying<M>>) => Promise<T>
): Promise<T> {

  if (Object.prototype.hasOwnProperty.call(txnClientOrPool, '_zapatos')) {
    return callback(txnClientOrPool as TxnClient<IsolationSatisfying<M>>);
  }

  const
    txnId = txnSeq++,
    txnClient = await txnClientOrPool.connect() as TxnClient<M>,
    config = getConfig(),
    { transactionListener } = config,
    maxAttempts = config.transactionAttemptsMax,
    { minMs, maxMs } = config.transactionRetryDelay;

  txnClient._zapatos = { isolationLevel, txnId };

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        if (attempt > 1 && transactionListener) transactionListener(`Retrying transaction, attempt ${attempt} of ${maxAttempts}`, txnId);

        await sql`START TRANSACTION ISOLATION LEVEL ${raw(isolationLevel)}`.run(txnClient);
        const result = await callback(txnClient as TxnClient<IsolationSatisfying<M>>);
        await sql`COMMIT`.run(txnClient);

        return result;

      } catch (err) {
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
    txnClient.release();
  }
}

/**
 * Shortcut for `transaction` with isolation level `Serializable`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database 
 * client
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializable<T>(txnClientOrPool: pg.Pool | TxnClientForSerializable, callback: (client: TxnClientForSerializable) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.Serializable, callback);
}
/**
 * Shortcut for `transaction` with isolation level `RepeatableRead`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database 
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function repeatableRead<T>(txnClientOrPool: pg.Pool | TxnClientForRepeatableRead, callback: (client: TxnClientForRepeatableRead) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.RepeatableRead, callback);
}
/**
 * Shortcut for `transaction` with isolation level `ReadCommitted`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database 
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided 
 * to it
 */
export async function readCommitted<T>(txnClientOrPool: pg.Pool | TxnClientForReadCommitted, callback: (client: TxnClientForReadCommitted) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.ReadCommitted, callback);
}
/**
 * Shortcut for `transaction` with isolation level `SerializableRO`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializableRO<T>(txnClientOrPool: pg.Pool | TxnClientForSerializableRO, callback: (client: TxnClientForSerializableRO) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.SerializableRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `RepeatableReadRO`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function repeatableReadRO<T>(txnClientOrPool: pg.Pool | TxnClientForRepeatableReadRO, callback: (client: TxnClientForRepeatableReadRO) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.RepeatableReadRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `ReadCommittedRO`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function readCommittedRO<T>(txnClientOrPool: pg.Pool | TxnClientForReadCommittedRO, callback: (client: TxnClientForReadCommittedRO) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.ReadCommittedRO, callback);
}
/**
 * Shortcut for `transaction` with isolation level `SerializableRODeferrable`.
 * @param txnClientOrPool The `pg.Pool` from which to check out the database
 * client or an appropriate client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export async function serializableRODeferrable<T>(txnClientOrPool: pg.Pool | TxnClientForSerializableRODeferrable, callback: (client: TxnClientForSerializableRODeferrable) => Promise<T>) {
  return transaction(txnClientOrPool, IsolationLevel.SerializableRODeferrable, callback);
}
