/*
** DON'T EDIT THIS FILE (unless you're working on Zapatos) **
It's part of Zapatos, and will be overwritten when the database schema is regenerated

Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type {
  SelectableForTable,
  WhereableForTable,
  InsertableForTable,
  UpdatableForTable,
  ColumnForTable,
  UniqueIndexForTable,
  SQLForTable,
  Insertable,
  Updatable,
  Whereable,
  Table,
  Column,
} from '../schema';

import {
  AllType,
  all,
  DateString,
  SQL,
  SQLFragment,
  sql,
  cols,
  vals,
  raw,
  param,
} from './core';

import { completeKeysWithDefault, mapWithSeparator } from './utils';

type JSONSelectableForTable<T extends Table> = { [K in keyof SelectableForTable<T>]:
  Date extends SelectableForTable<T>[K] ? Exclude<SelectableForTable<T>[K], Date> | DateString :
  Date[] extends SelectableForTable<T>[K] ? Exclude<SelectableForTable<T>[K], Date[]> | DateString[] :
  SelectableForTable<T>[K]
};


/* === insert === */

interface InsertSignatures {
  <T extends Table>(table: T, values: InsertableForTable<T>): SQLFragment<JSONSelectableForTable<T>>;
  <T extends Table>(table: T, values: InsertableForTable<T>[]): SQLFragment<JSONSelectableForTable<T>[]>;
}

/**
 * Generate an `INSERT` query `SQLFragment`.
 * @param table The table into which to insert
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
export const insert: InsertSignatures = function
  (table: Table, values: Insertable | Insertable[]): SQLFragment<any> {

  let query;
  if (Array.isArray(values) && values.length === 0) {
    query = sql`INSERT INTO ${table} SELECT null WHERE false`;
    query.noop = true;
    query.noopResult = [];

  } else {
    const
      completedValues = Array.isArray(values) ? completeKeysWithDefault(values) : values,
      colsSQL = cols(Array.isArray(completedValues) ? completedValues[0] : completedValues),
      valuesSQL = Array.isArray(completedValues) ?
        mapWithSeparator(completedValues as Insertable[], sql<SQL>`, `, v => sql<SQL>`(${vals(v)})`) :
        sql<SQL>`(${vals(completedValues)})`;

    query = sql<SQL>`INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} RETURNING to_jsonb(${table}.*) AS result`;
  }

  query.runResultTransform = Array.isArray(values) ?
    (qr) => qr.rows.map(r => r.result) :
    (qr) => qr.rows[0].result;

  return query;
};


/* === upsert === */

/**
 * Wraps a unique index of the target table for use as the arbiter constraint of an 
 * `upsert` shortcut query.
 */
export class Constraint<T extends Table> { constructor(public value: UniqueIndexForTable<T>) { } }
/**
 * Returns a `Constraint` instance, wrapping a unique index of the target table for 
 * use as the arbiter constraint of an `upsert` shortcut query.
 */
export function constraint<T extends Table>(x: UniqueIndexForTable<T>) { return new Constraint<T>(x); }

export interface UpsertAction { $action: 'INSERT' | 'UPDATE' }
type UpsertReturnableForTable<T extends Table> = JSONSelectableForTable<T> & UpsertAction;
type UpsertConflictTargetForTable<T extends Table> = Constraint<T> | ColumnForTable<T> | ColumnForTable<T>[];

interface UpsertSignatures {
  <T extends Table>(table: T, values: InsertableForTable<T>, conflictTarget: UpsertConflictTargetForTable<T>, noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>>;
  <T extends Table>(table: T, values: InsertableForTable<T>[], conflictTarget: UpsertConflictTargetForTable<T>, noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>[]>;
}

/**
 * Generate an 'upsert' (`INSERT ... ON CONFLICT ...`) query `SQLFragment`.
 * @param table The table to update or insert into
 * @param values An `Insertable` of values (or an array thereof) to be inserted or updated
 * @param conflictTarget A `UNIQUE` index or `UNIQUE`-indexed column (or array thereof) that determines
 * whether this is an `UPDATE` (when there's a matching existing value) or an `INSERT` 
 * (when there isn't)
 * @param noNullUpdateCols Optionally, a column (or array thereof) that should not be 
 * overwritten with `NULL` values during an update
 */
export const upsert: UpsertSignatures = function
  (table: Table, values: Insertable | Insertable[], conflictTarget: Column | Column[] | Constraint<Table>, noNullUpdateCols: Column | Column[] = []): SQLFragment<any> {

  if (Array.isArray(values) && values.length === 0) return insert(table, values);  // punt a no-op to plain insert

  if (typeof conflictTarget === 'string') conflictTarget = [conflictTarget];  // now either Column[] or Constraint
  if (!Array.isArray(noNullUpdateCols)) noNullUpdateCols = [noNullUpdateCols];

  const
    completedValues = Array.isArray(values) ? completeKeysWithDefault(values) : values,
    firstRow = Array.isArray(completedValues) ? completedValues[0] : completedValues,
    colsSQL = cols(firstRow),
    valuesSQL = Array.isArray(completedValues) ?
      mapWithSeparator(completedValues as Insertable[], sql`, `, v => sql`(${vals(v)})`) :
      sql`(${vals(completedValues)})`,
    colNames = Object.keys(firstRow) as Column[],
    nonUniqueCols = Array.isArray(conflictTarget) ?
      colNames.filter(v => !(conflictTarget as Column[]).includes(v)) :
      colNames,
    uniqueColsSQL = Array.isArray(conflictTarget) ?
      sql`(${mapWithSeparator(conflictTarget.slice().sort(), sql`, `, c => c)})` :
      sql<string>`ON CONSTRAINT ${conflictTarget.value}`,
    updateColsSQL = mapWithSeparator(nonUniqueCols.slice().sort(), sql`, `, c => c),
    updateValuesSQL = mapWithSeparator(nonUniqueCols.slice().sort(), sql`, `, c =>
      noNullUpdateCols.includes(c) ? sql`CASE WHEN EXCLUDED.${c} IS NULL THEN ${table}.${c} ELSE EXCLUDED.${c} END` : sql`EXCLUDED.${c}`);

  // the added-on $action = 'INSERT' | 'UPDATE' key takes after SQL Server's approach to MERGE
  // (and on the use of xmax for this purpose, see: https://stackoverflow.com/questions/39058213/postgresql-upsert-differentiate-inserted-and-updated-rows-using-system-columns-x)

  const query = sql<SQL>`INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} ON CONFLICT ${uniqueColsSQL} DO UPDATE SET (${updateColsSQL}) = ROW(${updateValuesSQL}) RETURNING to_jsonb(${table}.*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result`;

  query.runResultTransform = Array.isArray(completedValues) ?
    (qr) => qr.rows.map(r => r.result) :
    (qr) => qr.rows[0].result;

  return query;
};


/* === update === */

interface UpdateSignatures {
  <T extends Table>(table: T, values: UpdatableForTable<T>, where: WhereableForTable<T> | SQLFragment): SQLFragment<JSONSelectableForTable<T>[]>;
}

/**
 * Generate an `UPDATE` query `SQLFragment`.
 * @param table The table to update
 * @param values An `Updatable` of the new values with which to update the table
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to update
 */
export const update: UpdateSignatures = function (
  table: Table,
  values: Updatable,
  where: Whereable | SQLFragment): SQLFragment {

  // note: the ROW() constructor below is required in Postgres 10+ if we're updating a single column
  // more info: https://www.postgresql-archive.org/Possible-regression-in-UPDATE-SET-lt-column-list-gt-lt-row-expression-gt-with-just-one-single-column0-td5989074.html

  const query = sql<SQL>`UPDATE ${table} SET (${cols(values)}) = ROW(${vals(values)}) WHERE ${where} RETURNING to_jsonb(${table}.*) AS result`;
  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
};


/* === delete === */

export interface DeleteSignatures {
  <T extends Table>(table: T, where: WhereableForTable<T> | SQLFragment): SQLFragment<JSONSelectableForTable<T>[]>;
}

/**
 * Generate an `DELETE` query `SQLFragment` (sadly, plain 'delete' is a reserved word).
 * @param table The table to delete from
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to delete
 */
export const deletes: DeleteSignatures = function
  (table: Table, where: Whereable | SQLFragment): SQLFragment {

  const query = sql<SQL>`DELETE FROM ${table} WHERE ${where} RETURNING to_jsonb(${table}.*) AS result`;
  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
};


/* === truncate === */

type TruncateIdentityOpts = 'CONTINUE IDENTITY' | 'RESTART IDENTITY';
type TruncateForeignKeyOpts = 'RESTRICT' | 'CASCADE';

interface TruncateSignatures {
  (table: Table | Table[]): SQLFragment<undefined>;
  (table: Table | Table[], optId: TruncateIdentityOpts): SQLFragment<undefined>;
  (table: Table | Table[], optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
  (table: Table | Table[], optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
}

/**
 * Generate a `TRUNCATE` query `SQLFragment`.
 * @param table The table (or array thereof) to truncate
 * @param opts Options: 'CONTINUE IDENTITY'/'RESTART IDENTITY' and/or 'RESTRICT'/'CASCADE'
 */
export const truncate: TruncateSignatures = function
  (table: Table | Table[], ...opts: string[]): SQLFragment<undefined> {

  if (!Array.isArray(table)) table = [table];
  const
    tables = mapWithSeparator(table, sql`, `, t => t),
    query = sql<SQL, undefined>`TRUNCATE ${tables}${raw((opts.length ? ' ' : '') + opts.join(' '))}`;

  return query;
};


/* === select === */

interface OrderSpecForTable<T extends Table> {
  by: SQLForTable<T>;
  direction: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface SelectLockingOptions {
  for: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
  of?: Table | Table[];
  wait?: 'NOWAIT' | 'SKIP LOCKED';
}

export interface SelectOptionsForTable<
  T extends Table,
  C extends ColumnForTable<T>[] | undefined,
  L extends SQLFragmentsMap | undefined,
  E extends SQLFragmentsMap | undefined,
  > {
  order?: OrderSpecForTable<T>[];
  limit?: number;
  offset?: number;
  columns?: C;
  extras?: E;
  lateral?: L;
  alias?: string;
  lock?: SelectLockingOptions | SelectLockingOptions[];
};

export interface SQLFragmentsMap { [k: string]: SQLFragment<any> }
export type PromisedType<P> = P extends Promise<infer U> ? U : never;
export type PromisedSQLFragmentReturnType<R extends SQLFragment<any>> = PromisedType<ReturnType<R['run']>>;

// yes, the next two types are identical, but distinct names make complex inferred types more readable
export type Lateral<L extends SQLFragmentsMap> = { [K in keyof L]: PromisedSQLFragmentReturnType<L[K]> };
export type Extras<L extends SQLFragmentsMap> = { [K in keyof L]: PromisedSQLFragmentReturnType<L[K]> };

export type JSONOnlyColsForTable<T extends Table, C extends any[] /* `ColumnForTable<T>[]` gives errors here for reasons I haven't got to the bottom of */> = Pick<JSONSelectableForTable<T>, C[number]>;

type BaseSelectReturnTypeForTable<T extends Table, C extends ColumnForTable<T>[] | undefined> =
  undefined extends C ? JSONSelectableForTable<T> :
  C extends ColumnForTable<T>[] ? JSONOnlyColsForTable<T, C> :
  never;

type EnhancedSelectReturnTypeForTable<
  T extends Table,
  C extends ColumnForTable<T>[] | undefined,
  L extends SQLFragmentsMap | undefined,
  E extends SQLFragmentsMap | undefined,
  > =
  undefined extends L ?
  (undefined extends E ? BaseSelectReturnTypeForTable<T, C> :
    E extends SQLFragmentsMap ? BaseSelectReturnTypeForTable<T, C> & Extras<E> :
    never) :
  L extends SQLFragmentsMap ?
  (undefined extends E ? BaseSelectReturnTypeForTable<T, C> & Lateral<L> :
    E extends SQLFragmentsMap ? BaseSelectReturnTypeForTable<T, C> & Lateral<L> & Extras<E> :
    never) :
  never;

export enum SelectResultMode { Many, One, ExactlyOne, Count }

export type FullSelectReturnTypeForTable<
  T extends Table,
  C extends ColumnForTable<T>[] | undefined,
  L extends SQLFragmentsMap | undefined,
  E extends SQLFragmentsMap | undefined,
  M extends SelectResultMode,
  > =
  {
    [SelectResultMode.Many]: EnhancedSelectReturnTypeForTable<T, C, L, E>[];
    [SelectResultMode.ExactlyOne]: EnhancedSelectReturnTypeForTable<T, C, L, E>;
    [SelectResultMode.One]: EnhancedSelectReturnTypeForTable<T, C, L, E> | undefined;
    [SelectResultMode.Count]: number;
  }[M];

export interface SelectSignatures {
  <T extends Table,
    C extends ColumnForTable<T>[] | undefined,
    L extends SQLFragmentsMap | undefined,
    E extends SQLFragmentsMap | undefined,
    M extends SelectResultMode = SelectResultMode.Many
    >(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
    mode?: M,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, M>>;
}

export class NotExactlyOneError extends Error {
  // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
  query: SQLFragment;
  constructor(query: SQLFragment, ...params: any[]) {
    super(...params);
    if (Error.captureStackTrace) Error.captureStackTrace(this, NotExactlyOneError);  // V8 only
    this.name = 'NotExactlyOneError';
    this.query = query;  // custom property
  }
}

/**
 * Generate a `SELECT` query `SQLFragment`. This can be nested with other `select`/
 * `selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected, or `all`
 * @param options Options object. Keys (all optional) are: 
 * * `columns` — an array of column names: only these columns will be returned
 * * `order` – an array of `OrderSpec` objects, such as `{ by: 'column', direction: 'ASC' 
 * }`  
 * * `limit` and `offset` – numbers: apply this limit and offset to the query
 * * `lateral` — an object mapping key(s) to nested `select`/`selectOne`/`count` queries 
 * to be `LATERAL JOIN`ed
 * * `alias` — table alias (string): required if using `lateral` to join a table to itself
 * * `extras` — an object mapping key(s) to `SQLFragment`s, so that derived 
 * quantities can be included in the JSON result
 * @param mode Used internally by `selectOne` and `count`
 */
export const select: SelectSignatures = function (
  table: Table,
  where: Whereable | SQLFragment | AllType = all,
  options: SelectOptionsForTable<Table, ColumnForTable<Table>[] | undefined, SQLFragmentsMap | undefined, SQLFragmentsMap | undefined> = {},
  mode: SelectResultMode = SelectResultMode.Many,
) {

  const
    limit1 = mode === SelectResultMode.One || mode === SelectResultMode.ExactlyOne,
    allOptions = limit1 ? { ...options, limit: 1 } : options,
    aliasedTable = allOptions.alias || table,
    lateralOpt = allOptions.lateral,
    extrasOpt = allOptions.extras,
    lockOpt = allOptions.lock === undefined || Array.isArray(allOptions.lock) ? allOptions.lock : [allOptions.lock],
    tableAliasSQL = aliasedTable === table ? [] : sql<string>` AS ${aliasedTable}`,
    colsSQL = mode === SelectResultMode.Count ?
      (allOptions.columns ? sql`count(${cols(allOptions.columns)})` : sql<typeof aliasedTable>`count(${aliasedTable}.*)`) :
      allOptions.columns ?
        sql`jsonb_build_object(${mapWithSeparator(allOptions.columns, sql`, `, c => sql<SQL>`${param(c)}::text, ${c}`)})` :
        sql<typeof aliasedTable>`to_jsonb(${aliasedTable}.*)`,
    colsLateralSQL = lateralOpt === undefined ? [] :
      sql` || jsonb_build_object(${mapWithSeparator(
        Object.keys(lateralOpt), sql`, `, (k, i) => sql<SQL>`${param(k)}::text, "ljoin_${raw(String(i))}".result`)})`,
    colsExtraSQL = extrasOpt === undefined ? [] :
      sql<any[]>` || jsonb_build_object(${mapWithSeparator(
        Object.keys(extrasOpt), sql`, `, k => sql<SQL>`${param(k)}::text, ${extrasOpt![k]}`)})`,
    allColsSQL = sql`${colsSQL}${colsLateralSQL}${colsExtraSQL}`,
    whereSQL = where === all ? [] : sql` WHERE ${where}`,
    orderSQL = !allOptions.order ? [] :
      sql` ORDER BY ${mapWithSeparator(allOptions.order, sql`, `, o => {
        if (!['ASC', 'DESC'].includes(o.direction)) throw new Error(`Direction must be ASC/DESC, not '${o.direction}'`);
        if (o.nulls && !['FIRST', 'LAST'].includes(o.nulls)) throw new Error(`Nulls must be FIRST/LAST/undefined, not '${o.nulls}'`);
        return sql`${o.by} ${raw(o.direction)}${o.nulls ? sql` NULLS ${raw(o.nulls)}` : []}`;
      })}`,
    limitSQL = allOptions.limit === undefined ? [] : sql` LIMIT ${param(allOptions.limit)}`,
    offsetSQL = allOptions.offset === undefined ? [] : sql` OFFSET ${param(allOptions.offset)}`,
    lockSQL = lockOpt === undefined ? [] : lockOpt.map(lock => {
      const
        ofTables = lock.of === undefined || Array.isArray(lock.of) ? lock.of : [lock.of],
        ofClause = ofTables === undefined ? [] : sql` OF ${mapWithSeparator(ofTables, sql`, `, t => t)}`;
      return sql<SQL>` FOR ${raw(lock.for)}${ofClause}${lock.wait ? sql` ${raw(lock.wait)}` : []}`;
    }),
    lateralSQL = lateralOpt === undefined ? [] :
      Object.keys(lateralOpt).map((k, i) => {
        const subQ = lateralOpt[k];
        subQ.parentTable = aliasedTable;  // enables `parent('column')` in subquery's Wherables
        return sql<SQL>` LEFT JOIN LATERAL (${subQ}) AS "ljoin_${raw(String(i))}" ON true`;
      });

  const
    rowsQuery = sql<SQL, any>`SELECT ${allColsSQL} AS result FROM ${table}${tableAliasSQL}${lateralSQL}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}${lockSQL}`,
    query = mode !== SelectResultMode.Many ? rowsQuery :
      // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
      sql<SQL, any>`SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${raw(`"sq_${aliasedTable}"`)}`;

  query.runResultTransform =

    mode === SelectResultMode.Count ?
      // note: pg deliberately returns strings for int8 in case 64-bit numbers overflow
      // (see https://github.com/brianc/node-pg-types#use), but we assume our counts aren't that big
      (qr) => Number(qr.rows[0].result) :

      mode === SelectResultMode.ExactlyOne ?
        (qr) => {
          const result = qr.rows[0]?.result;
          if (result === undefined) throw new NotExactlyOneError(query, 'One result expected but none returned (hint: check `.query.compile()` on this Error)');
          return result;
        } :

        // SelectResultMode.One or SelectResultMode.Many
        (qr) => qr.rows[0]?.result;

  return query;
};


/* === selectOne === */

export interface SelectOneSignatures {
  <
    T extends Table,
    C extends ColumnForTable<T>[] | undefined,
    L extends SQLFragmentsMap | undefined,
    E extends SQLFragmentsMap | undefined
    >(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.One>>;
}

/**
 * Generate a `SELECT` query `SQLFragment` that returns only a single result (or 
 * undefined). A `LIMIT 1` clause is added automatically. This can be nested with other 
 * `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected, or `all`
 * @param options Options object. See documentation for `select` for details.
 */
export const selectOne: SelectOneSignatures = function (table, where, options = {}) {
  // you might argue that 'selectOne' offers little that you can't get with destructuring assignment 
  // and plain 'select' -- e.g. let [x] = async select(...).run(pool); -- but a thing that is definitely worth 
  // having is '| undefined' in the return signature, because the result of indexing never includes undefined
  // (see e.g. https://github.com/Microsoft/TypeScript/issues/13778)

  return select(table, where, options, SelectResultMode.One);
};


/* === selectExactlyOne === */

export interface SelectExactlyOneSignatures {
  <
    T extends Table,
    C extends ColumnForTable<T>[] | undefined,
    L extends SQLFragmentsMap | undefined,
    E extends SQLFragmentsMap | undefined
    >(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.ExactlyOne>>;
}

/**
 * Generate a `SELECT` query `SQLFragment` that returns a single result or throws an error. 
 * A `LIMIT 1` clause is added automatically. This can be nested with other 
 * `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected, or `all`
 * @param options Options object. See documentation for `select` for details.
 */

export const selectExactlyOne: SelectExactlyOneSignatures = function (table, where, options = {}) {
  return select(table, where, options, SelectResultMode.ExactlyOne);
};


/* === count === */

export interface CountSignatures {
  <T extends Table>(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: { columns?: ColumnForTable<T>[]; alias?: string },
  ): SQLFragment<number>;
}

/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be nested in 
 * other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted, or `all`
 * @param options Options object. Keys are: `columns`, `alias`.
 */
export const count: CountSignatures = function (table, where, options?) {
  return select(table, where, options, SelectResultMode.Count);
};
