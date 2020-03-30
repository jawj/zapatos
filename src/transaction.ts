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

export namespace TxnSatisfying {
  export type Serializable = Isolation.Serializable;
  export type RepeatableRead = Serializable | Isolation.RepeatableRead;
  export type ReadCommitted = RepeatableRead | Isolation.ReadCommitted;
  export type SerializableRO = Serializable | Isolation.SerializableRO;
  export type RepeatableReadRO = SerializableRO | RepeatableRead | Isolation.RepeatableReadRO;
  export type ReadCommittedRO = RepeatableReadRO | ReadCommitted | Isolation.ReadCommittedRO;
  export type SerializableRODeferrable = SerializableRO | Isolation.SerializableRODeferrable;
}

export interface TxnClient<T extends Isolation | undefined> extends pg.PoolClient {
  transactionMode: T;
}

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
    maxAttempts = config.transactionAttemptsMax,
    { minMs, maxMs } = config.transactionRetryDelay;
  
  txnClient.transactionMode = isolationMode;

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        if (attempt > 1) console.log(`Retrying transaction #${txnId}, attempt ${attempt} of ${maxAttempts}`);

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
            console.log(`Transaction #${txnId} rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, retrying in ${delayBeforeRetry}ms`);
            await wait(delayBeforeRetry);

          } else {
            console.log(`Transaction #${txnId} rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, giving up`);
            throw err;
          }

        } else {
          throw err;
        }
      }
    }

  } finally {
    (txnClient as any).transactionMode = undefined;
    txnClient.release();
  }
}
