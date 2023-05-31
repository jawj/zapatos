import * as pg from 'pg';
import type { Queryable } from './core';
export declare enum IsolationLevel {
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
export declare function transaction<T, M extends IsolationLevel>(txnClientOrQueryable: Queryable | TxnClient<IsolationSatisfying<M>>, isolationLevel: M, callback: (client: TxnClient<IsolationSatisfying<M>>) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `Serializable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function serializable<T>(txnClientOrQueryable: Queryable | TxnClientForSerializable, callback: (client: TxnClientForSerializable) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `RepeatableRead`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function repeatableRead<T>(txnClientOrQueryable: Queryable | TxnClientForRepeatableRead, callback: (client: TxnClientForRepeatableRead) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `ReadCommitted`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function readCommitted<T>(txnClientOrQueryable: Queryable | TxnClientForReadCommitted, callback: (client: TxnClientForReadCommitted) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `SerializableRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function serializableRO<T>(txnClientOrQueryable: Queryable | TxnClientForSerializableRO, callback: (client: TxnClientForSerializableRO) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `RepeatableReadRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function repeatableReadRO<T>(txnClientOrQueryable: Queryable | TxnClientForRepeatableReadRO, callback: (client: TxnClientForRepeatableReadRO) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `ReadCommittedRO`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function readCommittedRO<T>(txnClientOrQueryable: Queryable | TxnClientForReadCommittedRO, callback: (client: TxnClientForReadCommittedRO) => Promise<T>): Promise<T>;
/**
 * Shortcut for `transaction` with isolation level `SerializableRODeferrable`.
 * @param txnClientOrQueryable The `pg.Pool` from which to check out a client,
 * a plain client, or an existing transaction client to be passed through
 * @param callback A callback function that runs queries on the client provided
 * to it
 */
export declare function serializableRODeferrable<T>(txnClientOrQueryable: Queryable | TxnClientForSerializableRODeferrable, callback: (client: TxnClientForSerializableRODeferrable) => Promise<T>): Promise<T>;
