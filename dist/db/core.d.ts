/// <reference types="node" />
import type * as pg from 'pg';
import { SQLQuery } from './config';
import { NoInfer } from './utils';
import type { Updatable, Whereable, Table, Column } from 'zapatos/schema';
/**
 * Compiles to `DEFAULT` for use in `INSERT`/`UPDATE` queries.
 */
export declare const Default: unique symbol;
export type DefaultType = typeof Default;
/**
 * Compiles to the current column name within a `Whereable`.
 */
export declare const self: unique symbol;
export type SelfType = typeof self;
/**
 * Signals all rows are to be returned (without filtering via a `WHERE` clause)
 */
export declare const all: unique symbol;
export type AllType = typeof all;
/**
 * JSON types
 */
export type JSONValue = null | boolean | number | string | JSONObject | JSONArray;
export type JSONObject = {
    [k: string]: JSONValue;
};
export type JSONArray = JSONValue[];
/**
 * `int8` value represented as a string
 */
export type Int8String = `${number}`;
/**
 * Generic range value represented as a string
 */
export type RangeString<Bound extends string | number> = `${'[' | '('}${Bound},${Bound}${']' | ')'}`;
/**
 * `tsrange`, `tstzrange` or `daterange` value represented as a string. The
 * format of the upper and lower bound `date`, `timestamp` or `timestamptz`
 * values depends on pg's `DateStyle` setting.
 */
export type DateRangeString = RangeString<string>;
/**
 * `int4range`, `int8range` or `numrange` value represented as a string
 */
export type NumberRangeString = RangeString<number | ''>;
/**
 * `bytea` value represented as a hex string. Note: for large objects, use
 * something like https://www.npmjs.com/package/pg-large-object instead.
 */
export type ByteArrayString = `\\x${string}`;
/**
 * Make a function `STRICT` in the Postgres sense — where it's an alias for
 * `RETURNS NULL ON NULL INPUT` — with appropriate typing.
 *
 * For example, Zapatos' `toBuffer()` function is defined as:
 *
 * ```
 * export const toBuffer = strict((ba: ByteArrayString) => Buffer.from(ba.slice(2), 'hex'));
 * ```
 *
 * The generic input and output types `FnIn` and `FnOut` can be inferred from
 * `fn`, as seen above, but can also be explicitly narrowed. For example, to
 * convert specifically from `TimestampTzString` to Luxon's `DateTime`, but
 * pass through `null`s unchanged:
 *
 * ```
 * const toDateTime = db.strict<db.TimestampTzString, DateTime>(DateTime.fromISO);
 * ```
 *
 * @param fn The single-argument transformation function to be made strict.
 */
export declare function strict<FnIn, FnOut>(fn: (x: FnIn) => FnOut): <T extends FnIn | null>(d: T) => T extends FnIn ? Exclude<T, FnIn> | FnOut : T;
/**
 * Convert a `bytea` hex representation to a JavaScript `Buffer`. Note: for
 * large objects, use something like
 * [pg-large-object](https://www.npmjs.com/package/pg-large-object) instead.
 *
 * @param ba The `ByteArrayString` hex representation (or `null`)
 */
export declare const toBuffer: <T extends `\\x${string}` | null>(d: T) => T extends `\\x${string}` ? Buffer | Exclude<T, `\\x${string}`> : T;
/**
 * Compiles to a numbered query parameter (`$1`, `$2`, etc) and adds the wrapped value
 * at the appropriate position of the values array passed to `pg`.
 * @param x The value to be wrapped
 * @param cast Optional cast type. If a string, the parameter will be cast to
 * this type within the query e.g. `CAST($1 AS type)` instead of plain `$1`. If
 * `true`, the value will be JSON stringified and cast to `json` (irrespective
 * of the configuration parameters `castArrayParamsToJson` and
 * `castObjectParamsToJson`). If `false`, the value will **not** be JSON-
 * stringified or cast to `json` (again irrespective of the configuration
 * parameters `castArrayParamsToJson` and `castObjectParamsToJson`).
 */
export declare class Parameter<T = any> {
    value: T;
    cast?: string | boolean | undefined;
    constructor(value: T, cast?: string | boolean | undefined);
}
/**
 * Returns a `Parameter` instance, which compiles to a numbered query parameter
 * (`$1`, `$2`, etc) and adds its wrapped value at the appropriate position of
 * the values array passed to `pg`.
 * @param x The value to be wrapped
 * @param cast Optional cast type. If a string, the parameter will be cast to
 * this type within the query e.g. `CAST($1 AS type)` instead of plain `$1`. If
 * `true`, the value will be JSON stringified and cast to `json` (irrespective
 * of the configuration parameters `castArrayParamsToJson` and
 * `castObjectParamsToJson`). If `false`, the value will **not** be JSON
 * stringified or cast to `json` (again irrespective of the configuration
 * parameters `castArrayParamsToJson` and `castObjectParamsToJson`).
 */
export declare function param<T = any>(x: T, cast?: boolean | string): Parameter<T>;
/**
 * 💥💥💣 **DANGEROUS** 💣💥💥
 *
 * Compiles to the wrapped string value, as is, which may enable SQL injection
 * attacks.
 */
export declare class DangerousRawString {
    value: string;
    constructor(value: string);
}
/**
 * 💥💥💣 **DANGEROUS** 💣💥💥
 *
 * Remember [Little Bobby Tables](https://xkcd.com/327/).
 * Did you want `db.param` instead?
 * ---
 * Returns a `DangerousRawString` instance, wrapping a string.
 * `DangerousRawString` compiles to the wrapped string value, as-is, which may
 * enable SQL injection attacks.
 */
export declare function raw(x: string): DangerousRawString;
/**
 * Wraps either an array or object, and compiles to a quoted, comma-separated
 * list of array values (for use in a `SELECT` query) or object keys (for use
 * in an `INSERT`, `UPDATE` or `UPSERT` query, alongside `ColumnValues`).
 */
export declare class ColumnNames<T> {
    value: T;
    constructor(value: T);
}
/**
 * Returns a `ColumnNames` instance, wrapping either an array or an object.
 * `ColumnNames` compiles to a quoted, comma-separated list of array values (for
 * use in a `SELECT` query) or object keys (for use in an `INSERT`, `UDPATE` or
 * `UPSERT` query alongside a `ColumnValues`).
 */
export declare function cols<T>(x: T): ColumnNames<T>;
/**
 * Compiles to a quoted, comma-separated list of object keys for use in an
 * `INSERT`, `UPDATE` or `UPSERT` query, alongside `ColumnNames`.
 */
export declare class ColumnValues<T> {
    value: T;
    constructor(value: T);
}
/**
 * Returns a ColumnValues instance, wrapping an object. ColumnValues compiles to
 * a quoted, comma-separated list of object keys for use in an INSERT, UPDATE
 * or UPSERT query alongside a `ColumnNames`.
 */
export declare function vals<T>(x: T): ColumnValues<T>;
/**
 * Compiles to the name of the column it wraps in the table of the parent query.
 * @param value The column name
 */
export declare class ParentColumn<T extends Column | undefined = Column | undefined> {
    value?: T | undefined;
    constructor(value?: T | undefined);
}
/**
 * Returns a `ParentColumn` instance, wrapping a column name, which compiles to
 * that column name of the table of the parent query.
 */
export declare function parent<T extends Column | undefined = Column | undefined>(x?: T): ParentColumn<T>;
export type GenericSQLExpression = SQLFragment<any, any> | Parameter | DefaultType | DangerousRawString | SelfType;
export type SQLExpression = Table | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable | any[]> | Whereable | Column | ParentColumn | GenericSQLExpression;
export type SQL = SQLExpression | SQLExpression[];
export type Queryable = pg.ClientBase | pg.Pool;
/**
 * Tagged template function returning a `SQLFragment`. The first generic type
 * argument defines what interpolated value types are allowed. The second
 * defines what type the `SQLFragment` produces, where relevant (i.e. when
 * calling `.run(...)` on it, or using it as the value of an `extras` object).
 */
export declare function sql<Interpolations = SQL, RunResult = pg.QueryResult['rows'], Constraint = never>(literals: TemplateStringsArray, ...expressions: NoInfer<Interpolations>[]): SQLFragment<RunResult, Constraint>;
export declare class SQLFragment<RunResult = pg.QueryResult['rows'], Constraint = never> {
    protected literals: string[];
    protected expressions: SQL[];
    protected constraint?: Constraint;
    /**
     * When calling `run`, this function is applied to the object returned by `pg`
     * to produce the result that is returned. By default, the `rows` array is
     * returned — i.e. `(qr) => qr.rows` — but some shortcut functions alter this
     * in order to match their declared `RunResult` type.
     */
    runResultTransform: (qr: pg.QueryResult) => any;
    parentTable?: string;
    preparedName?: string;
    noop: boolean;
    noopResult: any;
    constructor(literals: string[], expressions: SQL[]);
    /**
     * Instruct Postgres to treat this as a prepared statement: see
     * https://node-postgres.com/features/queries#prepared-statements
     * @param name A name for the prepared query. If not specified, it takes the
     * value '_zapatos_prepared_N', where N is an increasing sequence number.
     */
    prepared: (name?: string) => this;
    /**
     * Compile and run this query using the provided database connection. What's
     * returned is piped via `runResultTransform` before being returned.
     * @param queryable A database client or pool
     * @param force If true, force this query to hit the DB even if it's marked as a no-op
     */
    run: (queryable: Queryable, force?: boolean) => Promise<RunResult>;
    /**
     * Compile this query, returning a `{ text: string, values: any[] }` object
     * that could be passed to the `pg` query function. Arguments are generally
     * only passed when the function calls itself recursively.
     */
    compile: (result?: SQLQuery, parentTable?: string, currentColumn?: Column) => SQLQuery;
    compileExpression: (expression: SQL, result?: SQLQuery, parentTable?: string, currentColumn?: Column) => void;
}
