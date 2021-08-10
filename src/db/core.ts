/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type * as pg from 'pg';
import { performance } from 'perf_hooks';

import { getConfig, SQLQuery } from './config';
import { isPOJO, NoInfer } from './utils';


// === symbols, types, wrapper classes and shortcuts ===

/** Allows injection of additional structures to zapatos */
export interface StructureMap {
}

/**
 * Compiles to `DEFAULT` for use in `INSERT`/`UPDATE` queries.
 */
export const Default = Symbol('DEFAULT');
export type DefaultType = typeof Default;

/**
 * Compiles to the current column name within a `Whereable`.
 */
export const self = Symbol('self');
export type SelfType = typeof self;

/**
 * Signals all rows are to be returned (without filtering via a `WHERE` clause)
 */
export const all = Symbol('all');
export type AllType = typeof all;

/**
 * JSON types
 */
export type JSONValue = null | boolean | number | string | JSONObject | JSONArray;
export type JSONObject = { [k: string]: JSONValue };
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
 * `bytea` value representated as a hex string. Note: for large objects, use
 * something like https://www.npmjs.com/package/pg-large-object instead.
 */
export type ByteArrayString = `\\x${string}`;

export type Column <S extends GenericSQLStructure> = Exclude<keyof S['Selectable'], number | symbol>;

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
export function strict<FnIn, FnOut>(fn: (x: FnIn) => FnOut):
  <T extends FnIn | null>(d: T) => T extends FnIn ? Exclude<T, FnIn> | FnOut : T {
  return function <T extends FnIn | null>(d: T) {
    return (d === null ? null : fn(d as FnIn)) as any;
  };
}

/**
 * Convert a `bytea` hex representation to a JavaScript `Buffer`. Note: for
 * large objects, use something like 
 * [pg-large-object](https://www.npmjs.com/package/pg-large-object) instead.
 * 
 * @param ba The `ByteArrayString` hex representation (or `null`)
 */
export const toBuffer = strict((ba: ByteArrayString) => Buffer.from(ba.slice(2), 'hex'));

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
export class Parameter<T = any> { constructor(public value: T, public cast?: boolean | string) { } }

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
export function param<T = any>(x: T, cast?: boolean | string) { return new Parameter(x, cast); }

/**
 * 💥💥💣 **DANGEROUS** 💣💥💥
 * 
 * Compiles to the wrapped string value, as is, which may enable SQL injection
 * attacks.
 */
export class DangerousRawString { constructor(public value: string) { } }

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
export function raw(x: string) { return new DangerousRawString(x); }

/**
 * Wraps either an array or object, and compiles to a quoted, comma-separated
 * list of array values (for use in a `SELECT` query) or object keys (for use
 * in an `INSERT`, `UPDATE` or `UPSERT` query, alongside `ColumnValues`).
 */
export class ColumnNames<T> { constructor(public value: T) { } }
/**
 * Returns a `ColumnNames` instance, wrapping either an array or an object.
 * `ColumnNames` compiles to a quoted, comma-separated list of array values (for
 * use in a `SELECT` query) or object keys (for use in an `INSERT`, `UDPATE` or
 * `UPSERT` query alongside a `ColumnValues`).
 */
export function cols<T>(x: T) { return new ColumnNames<T>(x); }

/**
 * Compiles to a quoted, comma-separated list of object keys for use in an
 * `INSERT`, `UPDATE` or `UPSERT` query, alongside `ColumnNames`.
 */
export class ColumnValues<T> { constructor(public value: T) { } }
/**
 * Returns a ColumnValues instance, wrapping an object. ColumnValues compiles to
 * a  quoted, comma-separated list of object keys for use in an INSERT, UPDATE
 * or UPSERT query alongside a `ColumnNames`.
 */
export function vals<T>(x: T) { return new ColumnValues<T>(x); }

/**
 * Compiles to the name of the column it wraps in the table of the parent query.
 * @param value The column name
 */
export class ParentColumn<T extends Column<GenericSQLStructure> = Column<SQLStructure>> { constructor(public value: T) { } }
/**
 * Returns a `ParentColumn` instance, wrapping a column name, which compiles to
 * that column name of the table of the parent query.
 */
export function parent<T extends Column<GenericSQLStructure> = Column<SQLStructure>>(x: T) { return new ParentColumn<T>(x); }


export type GenericSQLExpression = SQLFragment<any, any> | Parameter | DefaultType | DangerousRawString | SelfType;

export interface GenericSQLStructure {
  Schema: string;
  Table: string;
  Selectable: { [k: string]: any };
  JSONSelectable: object;
  Whereable: object;
  Insertable: object;
  Updatable: object;
  UniqueIndex: string;
}

export type SQLExpressionForStructure <S extends GenericSQLStructure> = GenericSQLExpression | ColumnNames<S['Updatable'] | (keyof S['Updatable'])[] | readonly (keyof S['Updatable'])[]> | ColumnValues<S['Updatable'] | any[] | readonly any[]> | S['Table'] | S['Schema'] | S['Whereable'] | Column<S>;
export type SQLForStructure <S extends GenericSQLStructure> = SQLExpressionForStructure<S> | Array<SQLExpressionForStructure<S>>;

export type GenericSQL = 
  | GenericSQLExpression
  | ColumnNames<GenericSQLStructure['Updatable']
  | (keyof GenericSQLStructure['Updatable'])[]>
  | ColumnValues<GenericSQLStructure['Updatable'] | any[] | readonly any[]>
  | GenericSQLStructure['Table']
  | GenericSQLStructure['Schema']
  | GenericSQLStructure['Whereable']
  | Column<GenericSQLStructure>;

export type SQLStructure = { [Key in keyof StructureMap]: StructureMap[Key] }[keyof StructureMap];

export type SQL = SQLForStructure<SQLStructure>;

export type Queryable = pg.ClientBase | pg.Pool;


// === SQL tagged template strings ===

/**
 * Tagged template function returning a `SQLFragment`. The first generic type
 * argument defines what interpolated value types are allowed. The second
 * defines what type the `SQLFragment` produces, where relevant (i.e. when
 * calling `.run(...)` on it, or using it as the value of an `extras` object).
 */
interface SqlSignatures {
  <
    Interpolations = SQL,
    RunResult = pg.QueryResult['rows'],
    Constraint = never,
  >(literals: TemplateStringsArray, ...expressions: NoInfer<Interpolations>[]): SQLFragment<RunResult, Constraint>;
  <
    Structure extends GenericSQLStructure = SQLStructure,
    RunResult = pg.QueryResult['rows'],
    Constraint = never,
    >(literals: TemplateStringsArray, ...expressions: NoInfer<SQLForStructure<Structure>>[]): SQLFragment<RunResult, Constraint>;
}

export const sql: SqlSignatures = (literals: TemplateStringsArray, ...expressions: NoInfer<GenericSQL>[]) => {
  return new SQLFragment<pg.QueryResult['rows'], never>(Array.prototype.slice.apply(literals), expressions);
};

let preparedNameSeq = 0;

export class SQLFragment<RunResult = pg.QueryResult['rows'], Constraint = never> {
  protected constraint?: Constraint;

  /**
   * When calling `run`, this function is applied to the object returned by `pg`
   * to produce the result that is returned. By default, the `rows` array is 
   * returned — i.e. `(qr) => qr.rows` — but some shortcut functions alter this
   * in order to match their declared `RunResult` type.
   */
  runResultTransform: (qr: pg.QueryResult) => any = qr => qr.rows;

  parentTable?: string = undefined;  // used for nested shortcut select queries
  preparedName?: string = undefined;  // for prepared statements

  noop = false;  // if true, bypass actually running the query unless forced to e.g. for empty INSERTs
  noopResult: any;  // if noop is true and DB is bypassed, what should be returned?

  constructor(protected literals: string[], protected expressions: GenericSQL[]) { }

  /**
   * Instruct Postgres to treat this as a prepared statement: see
   * https://node-postgres.com/features/queries#prepared-statements
   * @param name A name for the prepared query. If not specified, it takes the
   * value '_zapatos_prepared_N', where N is an increasing sequence number.
   */
  prepared = (name = `_zapatos_prepared_${preparedNameSeq++}`) => {
    this.preparedName = name;
    return this;
  };

  /**
   * Compile and run this query using the provided database connection. What's
   * returned is piped via `runResultTransform` before being returned.
   * @param queryable A database client or pool
   * @param force If true, force this query to hit the DB even if it's marked as a no-op
   */
  run = async (queryable: Queryable, force = false): Promise<RunResult> => {
    const
      query = this.compile(),
      config = getConfig(),
      txnId = (queryable as any)._zapatos?.txnId;

    if (config.queryListener) config.queryListener(query, txnId);

    const startMs = performance.now();

    let result;
    if (!this.noop || force) {
      const qr = await queryable.query(query);
      result = this.runResultTransform(qr);

    } else {
      result = this.noopResult;
    }

    if (config.resultListener) config.resultListener(result, txnId, performance.now() - startMs);
    return result;
  };

  /**
   * Compile this query, returning a `{ text: string, values: any[] }` object
   * that could be passed to the `pg` query function. Arguments are generally
   * only passed when the function calls itself recursively.
   */
  compile = (result: SQLQuery = { text: '', values: [] }, parentTable?: string, currentColumn?: Column<GenericSQLStructure>) => {
    if (this.parentTable) parentTable = this.parentTable;

    if (this.noop) result.text += "/* marked no-op: won't hit DB unless forced -> */ ";
    result.text += this.literals[0];
    for (let i = 1, len = this.literals.length; i < len; i++) {
      this.compileExpression(this.expressions[i - 1], result, parentTable, currentColumn);
      result.text += this.literals[i];
    }

    if (this.preparedName != null) result.name = this.preparedName;

    return result;
  };

  compileExpression = (expression: GenericSQL, result: SQLQuery = { text: '', values: [] }, parentTable?: string, currentColumn?: Column<GenericSQLStructure>) => {
    if (this.parentTable) parentTable = this.parentTable;

    if (expression instanceof SQLFragment) {
      // another SQL fragment? recursively compile this one
      expression.compile(result, parentTable, currentColumn);

    } else if (typeof expression === 'string') {
      // if it's a string, it should be a x.Table or x.Column type, so just needs quoting
      result.text += expression.charAt(0) === '"' ? expression : `"${expression}"`;

    } else if (expression instanceof DangerousRawString) {
      // Little Bobby Tables passes straight through ...
      result.text += expression.value;

    } else if (Array.isArray(expression)) {
      // an array's elements are compiled one by one -- note that an empty array can be used as a non-value
      for (let i = 0, len = expression.length; i < len; i++) this.compileExpression(expression[i], result, parentTable, currentColumn);

    } else if (expression instanceof Parameter) {
      // parameters become placeholders, and a corresponding entry in the values array
      const
        placeholder = '$' + String(result.values.length + 1),  // 1-based indexing
        config = getConfig();

      if (
        ((expression.cast !== false && (expression.cast === true || config.castArrayParamsToJson)) &&
          Array.isArray(expression.value)) ||
        ((expression.cast !== false && (expression.cast === true || config.castObjectParamsToJson)) &&
          isPOJO(expression.value))
      ) {
        result.values.push(JSON.stringify(expression.value));
        result.text += `CAST(${placeholder} AS "json")`;

      } else if (typeof expression.cast === 'string') {
        result.values.push(expression.value);
        result.text += `CAST(${placeholder} AS "${expression.cast}")`;

      } else {
        result.values.push(expression.value);
        result.text += placeholder;
      }

    } else if (expression === Default) {
      // a column default
      result.text += 'DEFAULT';

    } else if (expression === self) {
      // alias to the latest column, if applicable
      if (!currentColumn) throw new Error(`The 'self' column alias has no meaning here`);
      result.text += `"${currentColumn}"`;

    } else if (expression instanceof ParentColumn) {
      // alias to the parent table (plus supplied column name) of a nested query, if applicable
      if (!parentTable) throw new Error(`The 'parent' table alias has no meaning here`);
      result.text += `"${parentTable}"."${expression.value}"`;

    } else if (expression instanceof ColumnNames) {
      // a ColumnNames-wrapped object -> quoted names in a repeatable order
      // OR a ColumnNames-wrapped array -> quoted array values
      const columnNames = Array.isArray(expression.value) ? expression.value :
        Object.keys(expression.value).sort();
      result.text += columnNames.map(k => `"${k}"`).join(', ');

    } else if (expression instanceof ColumnValues) {
      // a ColumnValues-wrapped object OR array 
      // -> values (in ColumnNames-matching order, if applicable) punted as SQLFragments or Parameters

      if (Array.isArray(expression.value)) {
        const values: any[] = expression.value;
        for (let i = 0, len = values.length; i < len; i++) {
          const value = values[i];
          if (i > 0) result.text += ', ';
          if (value instanceof SQLFragment) this.compileExpression(value, result, parentTable);
          else this.compileExpression(new Parameter(value), result, parentTable);
        }

      } else {
        const
          columnNames = <Column<GenericSQLStructure>[]>Object.keys(expression.value).sort(),
          columnValues = columnNames.map(k => (<any>expression.value)[k]);

        for (let i = 0, len = columnValues.length; i < len; i++) {
          const
            columnName = columnNames[i],
            columnValue = columnValues[i];
          if (i > 0) result.text += ', ';
          if (columnValue instanceof SQLFragment ||
            columnValue instanceof Parameter ||
            columnValue === Default) this.compileExpression(columnValue, result, parentTable, columnName);
          else this.compileExpression(new Parameter(columnValue), result, parentTable, columnName);
        }
      }

    } else if (typeof expression === 'object') {
      // must be a Whereable object, so put together a WHERE clause
      const columnNames = <Column<GenericSQLStructure>[]>Object.keys(expression).sort();

      if (columnNames.length) {  // if the object is not empty
        result.text += '(';
        for (let i = 0, len = columnNames.length; i < len; i++) {
          const
            columnName = columnNames[i],
            columnValue = (<any>expression)[columnName];
          if (i > 0) result.text += ' AND ';
          if (columnValue instanceof SQLFragment) {
            result.text += '(';
            this.compileExpression(columnValue, result, parentTable, columnName);
            result.text += ')';

          } else {
            result.text += `"${columnName}" = `;
            this.compileExpression(columnValue instanceof ParentColumn ? columnValue : new Parameter(columnValue),
              result, parentTable, columnName);
          }
        }
        result.text += ')';

      } else {
        // or if it is empty, it should always match
        result.text += 'TRUE';
      }

    } else {
      throw new Error(`Alien object while interpolating SQL: ${expression}`);
    }
  };
}
