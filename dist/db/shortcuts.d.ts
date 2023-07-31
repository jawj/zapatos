import type { JSONSelectableForTable, WhereableForTable, InsertableForTable, UpdatableForTable, ColumnForTable, UniqueIndexForTable, SQLForTable, Table } from "zapatos/schema";
import { AllType, SQLFragment } from "./core";
import { NoInfer } from "./utils";
export type JSONOnlyColsForTable<T extends Table, C extends any[]> = Pick<JSONSelectableForTable<T>, C[number]>;
export interface SQLFragmentMap {
    [k: string]: SQLFragment<any>;
}
export interface SQLFragmentOrColumnMap<T extends Table> {
    [k: string]: SQLFragment<any> | ColumnForTable<T>;
}
export type RunResultForSQLFragment<T extends SQLFragment<any, any>> = T extends SQLFragment<infer RunResult, any> ? RunResult : never;
export type LateralResult<L extends SQLFragmentMap> = {
    [K in keyof L]: RunResultForSQLFragment<L[K]>;
};
export type ExtrasResult<T extends Table, E extends SQLFragmentOrColumnMap<T>> = {
    [K in keyof E]: E[K] extends SQLFragment<any> ? RunResultForSQLFragment<E[K]> : E[K] extends keyof JSONSelectableForTable<T> ? JSONSelectableForTable<T>[E[K]] : never;
};
type ExtrasOption<T extends Table> = SQLFragmentOrColumnMap<T> | undefined;
type ColumnsOption<T extends Table> = readonly ColumnForTable<T>[] | undefined;
type LimitedLateralOption = SQLFragmentMap | undefined;
type FullLateralOption = LimitedLateralOption | SQLFragment<any>;
type LateralOption<C extends ColumnsOption<Table>, E extends ExtrasOption<Table>> = undefined extends C ? undefined extends E ? FullLateralOption : LimitedLateralOption : LimitedLateralOption;
export interface ReturningOptionsForTable<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>> {
    returning?: C;
    extras?: E;
}
type ReturningTypeForTable<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>> = (undefined extends C ? JSONSelectableForTable<T> : C extends ColumnForTable<T>[] ? JSONOnlyColsForTable<T, C> : never) & (undefined extends E ? {} : E extends SQLFragmentOrColumnMap<T> ? ExtrasResult<T, E> : never);
interface InsertSignatures {
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>>(table: T, values: InsertableForTable<T>, options?: ReturningOptionsForTable<T, C, E>): SQLFragment<ReturningTypeForTable<T, C, E>>;
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>>(table: T, values: InsertableForTable<T>[], options?: ReturningOptionsForTable<T, C, E>): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
}
/**
 * Generate an `INSERT` query `SQLFragment`.
 * @param table The table into which to insert
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
export declare const insert: InsertSignatures;
/**
 * Wraps a unique index of the target table for use as the arbiter constraint
 * of an `upsert` shortcut query.
 */
export declare class Constraint<T extends Table> {
    value: UniqueIndexForTable<T>;
    constructor(value: UniqueIndexForTable<T>);
}
/**
 * Returns a `Constraint` instance, wrapping a unique index of the target table
 * for use as the arbiter constraint of an `upsert` shortcut query.
 */
export declare function constraint<T extends Table>(x: UniqueIndexForTable<T>): Constraint<T>;
export interface UpsertAction {
    $action: "INSERT" | "UPDATE";
}
type UpsertReportAction = "suppress";
type UpsertReturnableForTable<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>, RA extends UpsertReportAction | undefined> = ReturningTypeForTable<T, C, E> & (undefined extends RA ? UpsertAction : {});
type UpsertConflictTargetForTable<T extends Table> = Constraint<T> | ColumnForTable<T> | ColumnForTable<T>[];
type UpdateColumns<T extends Table> = ColumnForTable<T> | ColumnForTable<T>[];
interface UpsertOptions<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>, UC extends UpdateColumns<T> | undefined, RA extends UpsertReportAction | undefined> extends ReturningOptionsForTable<T, C, E> {
    updateValues?: UpdatableForTable<T>;
    updateColumns?: UC;
    noNullUpdateColumns?: ColumnForTable<T> | ColumnForTable<T>[];
    reportAction?: RA;
}
interface UpsertSignatures {
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>, UC extends UpdateColumns<T> | undefined, RA extends UpsertReportAction | undefined>(table: T, values: InsertableForTable<T>, conflictTarget: UpsertConflictTargetForTable<T>, options?: UpsertOptions<T, C, E, UC, RA>): SQLFragment<UpsertReturnableForTable<T, C, E, RA> | (UC extends never[] ? undefined : never)>;
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>, UC extends UpdateColumns<T> | undefined, RA extends UpsertReportAction | undefined>(table: T, values: InsertableForTable<T>[], conflictTarget: UpsertConflictTargetForTable<T>, options?: UpsertOptions<T, C, E, UC, RA>): SQLFragment<UpsertReturnableForTable<T, C, E, RA>[]>;
}
export declare const doNothing: never[];
/**
 * Generate an 'upsert' (`INSERT ... ON CONFLICT ...`) query `SQLFragment`.
 * @param table The table to update or insert into
 * @param values An `Insertable` of values (or an array thereof) to be inserted
 * or updated
 * @param conflictTarget A `UNIQUE`-indexed column (or array thereof) or a
 * `UNIQUE` index (wrapped in `db.constraint(...)`) that determines whether we
 * get an `UPDATE` (when there's a matching existing value) or an `INSERT`
 * (when there isn't)
 * @param options Optionally, an object with any of the keys `updateColumns`,
 * `noNullUpdateColumns` and `updateValues` (see documentation).
 */
export declare const upsert: UpsertSignatures;
interface UpdateSignatures {
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>>(table: T, values: UpdatableForTable<T>, where: WhereableForTable<T> | SQLFragment<any>, options?: ReturningOptionsForTable<T, C, E>): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
}
/**
 * Generate an `UPDATE` query `SQLFragment`.
 * @param table The table to update
 * @param values An `Updatable` of the new values with which to update the table
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to update
 */
export declare const update: UpdateSignatures;
export interface DeleteSignatures {
    <T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption<T>>(table: T, where: WhereableForTable<T> | SQLFragment<any>, options?: ReturningOptionsForTable<T, C, E>): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
}
/**
 * Generate an `DELETE` query `SQLFragment` (plain 'delete' is a reserved word)
 * @param table The table to delete from
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to delete
 */
export declare const deletes: DeleteSignatures;
type TruncateIdentityOpts = "CONTINUE IDENTITY" | "RESTART IDENTITY";
type TruncateForeignKeyOpts = "RESTRICT" | "CASCADE";
interface TruncateSignatures {
    (table: Table | Table[]): SQLFragment<undefined>;
    (table: Table | Table[], optId: TruncateIdentityOpts): SQLFragment<undefined>;
    (table: Table | Table[], optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
    (table: Table | Table[], optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
}
/**
 * Generate a `TRUNCATE` query `SQLFragment`.
 * @param table The table (or array thereof) to truncate
 * @param opts Options: 'CONTINUE IDENTITY'/'RESTART IDENTITY' and/or
 * 'RESTRICT'/'CASCADE'
 */
export declare const truncate: TruncateSignatures;
interface OrderSpecForTable<T extends Table> {
    by: SQLForTable<T>;
    direction: "ASC" | "DESC";
    nulls?: "FIRST" | "LAST";
}
type Unprefixed<S extends string> = S extends `${infer _}.${infer Rest}` ? Rest : S;
export interface SelectLockingOptions<A extends string> {
    for: "UPDATE" | "NO KEY UPDATE" | "SHARE" | "KEY SHARE";
    of?: Unprefixed<Table> | A | (Unprefixed<Table> | A)[];
    wait?: "NOWAIT" | "SKIP LOCKED";
}
export interface SelectOptionsForTable<T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, A extends string> {
    distinct?: boolean | ColumnForTable<T> | ColumnForTable<T>[] | SQLFragment<any>;
    order?: OrderSpecForTable<T> | OrderSpecForTable<T>[];
    limit?: number;
    offset?: number;
    withTies?: boolean;
    columns?: C;
    extras?: E;
    groupBy?: ColumnForTable<T> | ColumnForTable<T>[] | SQLFragment<any>;
    having?: WhereableForTable<T> | SQLFragment<any>;
    lateral?: L;
    alias?: A;
    lock?: SelectLockingOptions<NoInfer<A>> | SelectLockingOptions<NoInfer<A>>[];
}
type SelectReturnTypeForTable<T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>> = undefined extends L ? ReturningTypeForTable<T, C, E> : L extends SQLFragmentMap ? ReturningTypeForTable<T, C, E> & LateralResult<L> : L extends SQLFragment<any> ? RunResultForSQLFragment<L> : never;
export declare enum SelectResultMode {
    Many = 0,
    One = 1,
    ExactlyOne = 2,
    Numeric = 3
}
export type FullSelectReturnTypeForTable<T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, M extends SelectResultMode> = {
    [SelectResultMode.Many]: SelectReturnTypeForTable<T, C, L, E>[];
    [SelectResultMode.ExactlyOne]: SelectReturnTypeForTable<T, C, L, E>;
    [SelectResultMode.One]: SelectReturnTypeForTable<T, C, L, E> | undefined;
    [SelectResultMode.Numeric]: number;
}[M];
export interface SelectSignatures {
    <T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, A extends string = never, M extends SelectResultMode = SelectResultMode.Many>(table: T, where: WhereableForTable<T> | SQLFragment<any> | AllType, options?: SelectOptionsForTable<T, C, L, E, A>, mode?: M, aggregate?: string): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, M>>;
}
export declare class NotExactlyOneError extends Error {
    query: SQLFragment;
    constructor(query: SQLFragment, ...params: any[]);
}
/**
 * Generate a `SELECT` query `SQLFragment`. This can be nested with other
 * `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. Keys (all optional) are:
 * * `columns` — an array of column names: only these columns will be returned
 * * `order` – an array of `OrderSpec` objects, such as
 * `{ by: 'column', direction: 'ASC' }`
 * * `limit` and `offset` – numbers: apply this limit and offset to the query
 * * `lateral` — either an object mapping keys to nested `select`/`selectOne`/
 * `count` queries to be `LATERAL JOIN`ed, or a single `select`/`selectOne`/
 * `count` query whose result will be passed through directly as the result of
 * the containing query
 * * `alias` — table alias (string): required if using `lateral` to join a table
 * to itself
 * * `extras` — an object mapping key(s) to `SQLFragment`s, so that derived
 * quantities can be included in the JSON result
 * @param mode (Used internally by `selectOne` and `count`)
 */
export declare const select: SelectSignatures;
export interface SelectOneSignatures {
    <T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, A extends string>(table: T, where: WhereableForTable<T> | SQLFragment<any> | AllType, options?: SelectOptionsForTable<T, C, L, E, A>): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.One>>;
}
/**
 * Generate a `SELECT` query `SQLFragment` that returns only a single result (or
 * undefined). A `LIMIT 1` clause is added automatically. This can be nested with
 * other `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. See documentation for `select` for details.
 */
export declare const selectOne: SelectOneSignatures;
export interface SelectExactlyOneSignatures {
    <T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, A extends string>(table: T, where: WhereableForTable<T> | SQLFragment<any> | AllType, options?: SelectOptionsForTable<T, C, L, E, A>): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.ExactlyOne>>;
}
/**
 * Generate a `SELECT` query `SQLFragment` that returns a single result or
 * throws an error. A `LIMIT 1` clause is added automatically. This can be
 * nested with other `select`/`selectOne`/`count` queries using the `lateral`
 * option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. See documentation for `select` for details.
 */
export declare const selectExactlyOne: SelectExactlyOneSignatures;
export interface NumericAggregateSignatures {
    <T extends Table, C extends ColumnsOption<T>, L extends LateralOption<C, E>, E extends ExtrasOption<T>, A extends string>(table: T, where: WhereableForTable<T> | SQLFragment<any> | AllType, options?: SelectOptionsForTable<T, C, L, E, A>): SQLFragment<number>;
}
/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted,
 * or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export declare const count: NumericAggregateSignatures;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a sum. This can be
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export declare const sum: NumericAggregateSignatures;
/**
 * Generate a `SELECT` query `SQLFragment` that returns an arithmetic mean via
 * the `avg` aggregate function. This can be nested in other `select`/
 * `selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export declare const avg: NumericAggregateSignatures;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a minimum via the `min`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export declare const min: NumericAggregateSignatures;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a maximum via the `max`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export declare const max: NumericAggregateSignatures;
export {};
