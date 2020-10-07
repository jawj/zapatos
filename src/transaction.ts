/*
** DON'T EDIT THIS FILE (unless you're working on Zapatos) **
It's part of Zapatos, and will be overwritten when the database schema is regenerated

Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type * as pg from 'pg';
import { isDatabaseError } from './pgErrors';
import { wait } from './utils';
import { sql, raw } from './core';
import { getConfig } from "./config";


export enum Isolation {
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

export declare namespace TxnSatisfying {
  export type Serializable = Isolation.Serializable;
  export type RepeatableRead = Serializable | Isolation.RepeatableRead;
  export type ReadCommitted = RepeatableRead | Isolation.ReadCommitted;
  export type SerializableRO = Serializable | Isolation.SerializableRO;
  export type RepeatableReadRO = SerializableRO | RepeatableRead | Isolation.RepeatableReadRO;
  export type ReadCommittedRO = RepeatableReadRO | ReadCommitted | Isolation.ReadCommittedRO;
  export type SerializableRODeferrable = SerializableRO | Isolation.SerializableRODeferrable;
}

export interface TxnClient<_T extends Isolation> extends pg.PoolClient { }  // eslint-disable-line @typescript-eslint/no-unused-vars

let txnSeq = 0;

/**
 * Provide a database client to the callback, whose queries are then wrapped in a 
 * database transaction. The transaction is committed, retried, or rolled back as 
 * appropriate. 
 * @param pool The `pg.Pool` from which to check out the database client
 * @param isolationMode The `Isolation` mode (e.g `Serializable`) 
 * @param callback The callback function that runs queries on the provided client
 */
export async function transaction<T, M extends Isolation>(
  pool: pg.Pool,
  isolationMode: M,
  callback: (client: TxnClient<M>) => Promise<T>
): Promise<T> {

  const
    txnId = txnSeq++,
    txnClient = await pool.connect() as TxnClient<typeof isolationMode>,
    config = getConfig(),
    { transactionListener } = config,
    maxAttempts = config.transactionAttemptsMax,
    { minMs, maxMs } = config.transactionRetryDelay;

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        if (attempt > 1 && transactionListener) transactionListener(`Retrying transaction #${txnId}, attempt ${attempt} of ${maxAttempts}`);

        await sql`START TRANSACTION ISOLATION LEVEL ${raw(isolationMode)}`.run(txnClient);
        const result = await callback(txnClient);
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
            if (transactionListener) transactionListener(`Transaction #${txnId} rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, retrying in ${delayBeforeRetry}ms`);
            await wait(delayBeforeRetry);

          } else {
            if (transactionListener) transactionListener(`Transaction #${txnId} rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, giving up`);
            throw err;
          }

        } else {
          throw err;
        }
      }
    }

  } finally {
    txnClient.release();
  }
}

/**
 * Shortcut for `transaction` with isolation mode Serializable.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function serializable<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.Serializable>) => Promise<T>) {
  return transaction(pool, Isolation.Serializable, callback);
}
/**
 * Shortcut for `transaction` with isolation mode RepeatableRead.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function repeatableRead<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.RepeatableRead>) => Promise<T>) {
  return transaction(pool, Isolation.RepeatableRead, callback);
}
/**
 * Shortcut for `transaction` with isolation mode ReadCommitted.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function readCommitted<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.ReadCommitted>) => Promise<T>) {
  return transaction(pool, Isolation.ReadCommitted, callback);
}
/**
 * Shortcut for `transaction` with isolation mode SerializableRO.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function serializableRO<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.SerializableRO>) => Promise<T>) {
  return transaction(pool, Isolation.SerializableRO, callback);
}
/**
 * Shortcut for `transaction` with isolation mode RepeatableReadRO.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function repeatableReadRO<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.RepeatableReadRO>) => Promise<T>) {
  return transaction(pool, Isolation.RepeatableReadRO, callback);
}
/**
 * Shortcut for `transaction` with isolation mode ReadCommittedRO.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function readCommittedRO<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.ReadCommittedRO>) => Promise<T>) {
  return transaction(pool, Isolation.ReadCommittedRO, callback);
}
/**
 * Shortcut for `transaction` with isolation mode SerializableRODeferrable.
 * @param pool The `pg.Pool` from which to check out the database client
 * @param callback The callback function that runs queries on the provided client
 */
export async function serializableRODeferrable<T>(pool: pg.Pool, callback: (client: TxnClient<Isolation.SerializableRODeferrable>) => Promise<T>) {
  return transaction(pool, Isolation.SerializableRODeferrable, callback);
}
