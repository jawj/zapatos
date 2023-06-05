"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializableRODeferrable = exports.readCommittedRO = exports.repeatableReadRO = exports.serializableRO = exports.readCommitted = exports.repeatableRead = exports.serializable = exports.transaction = exports.IsolationLevel = void 0;
const pg = require("pg");
const pgErrors_1 = require("./pgErrors");
const utils_1 = require("./utils");
const core_1 = require("./core");
const config_1 = require("./config");
var IsolationLevel;
(function (IsolationLevel) {
    // these are the only meaningful values in Postgres: 
    // see https://www.postgresql.org/docs/11/sql-set-transaction.html
    IsolationLevel["Serializable"] = "SERIALIZABLE";
    IsolationLevel["RepeatableRead"] = "REPEATABLE READ";
    IsolationLevel["ReadCommitted"] = "READ COMMITTED";
    IsolationLevel["SerializableRO"] = "SERIALIZABLE, READ ONLY";
    IsolationLevel["RepeatableReadRO"] = "REPEATABLE READ, READ ONLY";
    IsolationLevel["ReadCommittedRO"] = "READ COMMITTED, READ ONLY";
    IsolationLevel["SerializableRODeferrable"] = "SERIALIZABLE, READ ONLY, DEFERRABLE";
})(IsolationLevel = exports.IsolationLevel || (exports.IsolationLevel = {}));
function typeofQueryable(queryable) {
    if (queryable instanceof pg.Pool)
        return 'pool';
    if (queryable instanceof pg.Client)
        return 'client';
    if (pg.native !== null && queryable instanceof pg.native.Pool)
        return 'pool';
    if (pg.native !== null && queryable instanceof pg.native.Client)
        return 'client';
    // for pg < 8, and sometimes in 8.x for reasons that aren't clear, all the
    // instanceof checks fail: then we resort to testing for the private variable
    // `_connected`, which is defined (as a boolean) on clients (pure JS and
    // native) but not on pools
    if (queryable._connected === undefined)
        return 'pool';
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
async function transaction(txnClientOrQueryable, isolationLevel, callback) {
    if (Object.prototype.hasOwnProperty.call(txnClientOrQueryable, '_zapatos')) {
        // if txnClientOrQueryable is a TxnClient, just pass it through
        return callback(txnClientOrQueryable);
    }
    if (txnSeq >= Number.MAX_SAFE_INTEGER - 1)
        txnSeq = 0; // wrap around
    const txnId = txnSeq++, clientIsOurs = typeofQueryable(txnClientOrQueryable) === 'pool', txnClient = (clientIsOurs ? await txnClientOrQueryable.connect() : txnClientOrQueryable);
    txnClient._zapatos = { isolationLevel, txnId };
    const config = (0, config_1.getConfig)(), { transactionListener } = config, maxAttempts = config.transactionAttemptsMax, { minMs, maxMs } = config.transactionRetryDelay;
    try {
        for (let attempt = 1;; attempt++) {
            try {
                if (attempt > 1 && transactionListener)
                    transactionListener(`Retrying transaction, attempt ${attempt} of ${maxAttempts}`, txnId);
                await (0, core_1.sql) `START TRANSACTION ISOLATION LEVEL ${(0, core_1.raw)(isolationLevel)}`.run(txnClient);
                const result = await callback(txnClient);
                await (0, core_1.sql) `COMMIT`.run(txnClient);
                return result;
            }
            catch (err) {
                await (0, core_1.sql) `ROLLBACK`.run(txnClient);
                // on trapping the following two rollback error codes, see:
                // https://www.postgresql.org/message-id/1368066680.60649.YahooMailNeo@web162902.mail.bf1.yahoo.com
                // this is also a good read:
                // https://www.enterprisedb.com/blog/serializable-postgresql-11-and-beyond
                if ((0, pgErrors_1.isDatabaseError)(err, "TransactionRollback_SerializationFailure", "TransactionRollback_DeadlockDetected")) {
                    if (attempt < maxAttempts) {
                        const delayBeforeRetry = Math.round(minMs + (maxMs - minMs) * Math.random());
                        if (transactionListener)
                            transactionListener(`Transaction rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, retrying in ${delayBeforeRetry}ms`, txnId);
                        await (0, utils_1.wait)(delayBeforeRetry);
                    }
                    else {
                        if (transactionListener)
                            transactionListener(`Transaction rollback (code ${err.code}) on attempt ${attempt} of ${maxAttempts}, giving up`, txnId);
                        throw err;
                    }
                }
                else {
                    throw err;
                }
            }
        }
    }
    finally {
        delete txnClient._zapatos;
        if (clientIsOurs)
            txnClient.release();
    }
}
exports.transaction = transaction;
/**
 * Shortcut for `transaction` with isolation level `Serializable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function serializable(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.Serializable, callback);
}
exports.serializable = serializable;
/**
 * Shortcut for `transaction` with isolation level `RepeatableRead`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function repeatableRead(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.RepeatableRead, callback);
}
exports.repeatableRead = repeatableRead;
/**
 * Shortcut for `transaction` with isolation level `ReadCommitted`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function readCommitted(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.ReadCommitted, callback);
}
exports.readCommitted = readCommitted;
/**
 * Shortcut for `transaction` with isolation level `SerializableRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function serializableRO(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.SerializableRO, callback);
}
exports.serializableRO = serializableRO;
/**
 * Shortcut for `transaction` with isolation level `RepeatableReadRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function repeatableReadRO(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.RepeatableReadRO, callback);
}
exports.repeatableReadRO = repeatableReadRO;
/**
 * Shortcut for `transaction` with isolation level `ReadCommittedRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function readCommittedRO(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.ReadCommittedRO, callback);
}
exports.readCommittedRO = readCommittedRO;
/**
 * Shortcut for `transaction` with isolation level `SerializableRODeferrable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
async function serializableRODeferrable(txnClientOrQueryable, callback) {
    return transaction(txnClientOrQueryable, IsolationLevel.SerializableRODeferrable, callback);
}
exports.serializableRODeferrable = serializableRODeferrable;
