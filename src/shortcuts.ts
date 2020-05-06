/*
** DON'T EDIT THIS FILE **
It's part of Zapatos, and will be overwritten when the database schema is regenerated

https://jawj.github.io/zapatos
Copyright (C) 2020 George MacKerron

This software is released under the MIT licence

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and / or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* tslint:disable */

import {
  SelectableForTable,
  WhereableForTable,
  InsertableForTable,
  UpdatableForTable,
  ColumnForTable,
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
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
export const insert: InsertSignatures = function
  (table: Table, values: Insertable | Insertable[]): SQLFragment<any> {

  const
    completedValues = Array.isArray(values) ? completeKeysWithDefault(values) : values,
    colsSQL = cols(Array.isArray(completedValues) ? completedValues[0] : completedValues),
    valuesSQL = Array.isArray(completedValues) ?
      mapWithSeparator(completedValues as Insertable[], sql<SQL>`, `, v => sql<SQL>`(${vals(v)})`) :
      sql<SQL>`(${vals(completedValues)})`,
    query = sql<SQL>`INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} RETURNING to_jsonb(${table}.*) AS result`;

  query.runResultTransform = Array.isArray(completedValues) ?
    (qr) => qr.rows.map(r => r.result) :
    (qr) => qr.rows[0].result;

  return query;
};


/* === upsert === */

interface UpsertAction { $action: 'INSERT' | 'UPDATE'; }
type UpsertReturnableForTable<T extends Table> = JSONSelectableForTable<T> & UpsertAction;

interface UpsertSignatures {
  <T extends Table>(table: T, values: InsertableForTable<T>, uniqueCols: ColumnForTable<T> | ColumnForTable<T>[], noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>>;
  <T extends Table>(table: T, values: InsertableForTable<T>[], uniqueCols: ColumnForTable<T> | ColumnForTable<T>[], noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>[]>;
}

/**
 * Generate an 'upsert' (`INSERT ... ON CONFLICT ...`) query `SQLFragment`.
 * @param table The table to update or insert into
 * @param values An `Insertable` of values (or an array thereof) to be inserted or updated
 * @param uniqueCols A `UNIQUE`-indexed column (or array thereof) that determines 
 * whether this is an `UPDATE` (when there's a matching existing value) or an `INSERT` 
 * (when there isn't)
 * @param noNullUpdateCols Optionally, a column (or array thereof) that should not be 
 * overwritten with `NULL` values during an update
 */
export const upsert: UpsertSignatures = function
  (table: Table, values: Insertable | Insertable[], uniqueCols: Column | Column[], noNullUpdateCols: Column | Column[] = []): SQLFragment<any> {

  if (!Array.isArray(uniqueCols)) uniqueCols = [uniqueCols];
  if (!Array.isArray(noNullUpdateCols)) noNullUpdateCols = [noNullUpdateCols];

  const
    completedValues = Array.isArray(values) ? completeKeysWithDefault(values) : values,
    colsSQL = cols(Array.isArray(completedValues) ? completedValues[0] : completedValues),
    valuesSQL = Array.isArray(completedValues) ?
      mapWithSeparator(completedValues as Insertable[], sql`, `, v => sql`(${vals(v)})`) :
      sql`(${vals(completedValues)})`,
    nonUniqueCols = (Object.keys(Array.isArray(completedValues) ? completedValues[0] : completedValues) as Column[])
      .filter(v => !uniqueCols.includes(v)),
    uniqueColsSQL = mapWithSeparator(uniqueCols.slice().sort(), sql`, `, c => c),
    updateColsSQL = mapWithSeparator(nonUniqueCols.slice().sort(), sql`, `, c => c),
    updateValuesSQL = mapWithSeparator(nonUniqueCols.slice().sort(), sql`, `, c =>
      noNullUpdateCols.includes(c) ? sql`CASE WHEN EXCLUDED.${c} IS NULL THEN ${table}.${c} ELSE EXCLUDED.${c} END` : sql`EXCLUDED.${c}`);

  // the added-on $action = 'INSERT' | 'UPDATE' key takes after SQL Server's approach to MERGE
  // (and on the use of xmax for this purpose, see: https://stackoverflow.com/questions/39058213/postgresql-upsert-differentiate-inserted-and-updated-rows-using-system-columns-x)

  const query = sql<SQL>`INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} ON CONFLICT (${uniqueColsSQL}) DO UPDATE SET (${updateColsSQL}) = ROW(${updateValuesSQL}) RETURNING to_jsonb(${table}.*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result`;

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

export interface SelectOptionsForTable<T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap> {
  order?: OrderSpecForTable<T>[];
  limit?: number;
  offset?: number;
  columns?: C;
  extras?: E;
  lateral?: L;
  alias?: string;
}

export interface SQLFragmentsMap { [k: string]: SQLFragment<any>; }
export type PromisedType<P> = P extends Promise<infer U> ? U : never;
export type PromisedSQLFragmentReturnType<R extends SQLFragment<any>> = PromisedType<ReturnType<R['run']>>;
export type PromisedSQLFragmentReturnTypeMap<L extends SQLFragmentsMap> = { [K in keyof L]: PromisedSQLFragmentReturnType<L[K]> };

export type JSONOnlyColsForTable<T extends Table, C extends any[] /* TS can't manage being more specific here */> = Pick<JSONSelectableForTable<T>, C[number]>;

type BaseSelectReturnTypeForTable<T extends Table, C extends ColumnForTable<T>[]> = C extends undefined ? JSONSelectableForTable<T> : JSONOnlyColsForTable<T, C>;

type EnhancedSelectReturnTypeForTable<T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap> =
  L extends undefined ?
  (E extends undefined ? BaseSelectReturnTypeForTable<T, C> : BaseSelectReturnTypeForTable<T, C> & PromisedSQLFragmentReturnTypeMap<E>) :
  (E extends undefined ?
    BaseSelectReturnTypeForTable<T, C> & PromisedSQLFragmentReturnTypeMap<L> :
    BaseSelectReturnTypeForTable<T, C> & PromisedSQLFragmentReturnTypeMap<L> & PromisedSQLFragmentReturnTypeMap<E>);

export type FullSelectReturnTypeForTable<T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap, M extends SelectResultMode> =
  M extends SelectResultMode.Many ? EnhancedSelectReturnTypeForTable<T, C, L, E>[] :
  M extends SelectResultMode.One ? EnhancedSelectReturnTypeForTable<T, C, L, E> | undefined : number;

export enum SelectResultMode { Many, One, Count }

export interface SelectSignatures {
  <T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap, M extends SelectResultMode = SelectResultMode.Many> (
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
    mode?: M,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, M>>;
}

/**
 * Generate a `SELECT` query `SQLFragment`. This can be nested with other `select`/
 * `selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected, or `all`
 * @param options Options object. Keys (all optional) are: 
 * * `columns` — an array of column names: only these columns will be returned
 * * `order` — an array of `OrderSpec` objects, such as `{ by: 'column', direction: 'ASC' 
 * }`  
 * * `limit` and `offset` — numbers: apply this limit and offset to the query
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
  options: SelectOptionsForTable<Table, ColumnForTable<Table>[], SQLFragmentsMap, SQLFragmentsMap> = {},
  mode: SelectResultMode = SelectResultMode.Many,
) {

  const
    allOptions = mode === SelectResultMode.One ? { ...options, limit: 1 } : options,
    aliasedTable = allOptions.alias || table,
    tableAliasSQL = aliasedTable === table ? [] : sql<string>` AS ${aliasedTable}`,
    colsSQL = mode === SelectResultMode.Count ?
      (allOptions.columns ? sql`count(${cols(allOptions.columns)})` : sql<typeof aliasedTable>`count(${aliasedTable}.*)`) :
      allOptions.columns ?
        sql`jsonb_build_object(${mapWithSeparator(allOptions.columns, sql`, `, c => raw(`'${c}', "${c}"`))})` :
        sql<typeof aliasedTable>`to_jsonb(${aliasedTable}.*)`,
    colsLateralSQL = allOptions.lateral === undefined ? [] :
      sql` || jsonb_build_object(${mapWithSeparator(
        Object.keys(allOptions.lateral), sql`, `, k => raw(`'${k}', "cj_${k}".result`))})`,
    colsExtraSQL = allOptions.extras === undefined ? [] :
      sql<any[]>` || jsonb_build_object(${mapWithSeparator(
        Object.keys(allOptions.extras), sql`, `, k => [raw(`'${k}', `), allOptions.extras![k]])})`,
    allColsSQL = sql`${colsSQL}${colsLateralSQL}${colsExtraSQL}`,
    whereSQL = where === all ? [] : sql` WHERE ${where}`,
    orderSQL = !allOptions.order ? [] :
      [sql` ORDER BY `, ...mapWithSeparator(allOptions.order, sql`, `, o =>
        sql`${o.by} ${raw(o.direction)}${o.nulls ? sql` NULLS ${raw(o.nulls)}` : []}`)],
    limitSQL = allOptions.limit === undefined ? [] : sql` LIMIT ${raw(String(allOptions.limit))}`,
    offsetSQL = allOptions.offset === undefined ? [] : sql` OFFSET ${raw(String(allOptions.offset))}`,
    lateralOpt = allOptions.lateral,
    lateralSQL = lateralOpt === undefined ? [] :
      Object.keys(lateralOpt).map(k => {
        const subQ = lateralOpt[k];
        subQ.parentTable = aliasedTable;  // enables `parent('column')` in subquery's Wherables
        return sql<SQL>` LEFT JOIN LATERAL (${subQ}) AS ${raw(`"cj_${k}"`)} ON true`;
      });

  const
    rowsQuery = sql<SQL, any>`SELECT ${allColsSQL} AS result FROM ${table}${tableAliasSQL}${lateralSQL}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`,
    query = mode !== SelectResultMode.Many ? rowsQuery :
      // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
      sql<SQL, any>`SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${raw(`"sq_${aliasedTable}"`)}`;

  query.runResultTransform = mode === SelectResultMode.Count ?
    // note: pg deliberately returns strings for int8 in case 64-bit numbers overflow
    // (see https://github.com/brianc/node-pg-types#use), but we assume counts aren't that big
    (qr) => Number(qr.rows[0].result) :
    (qr) => qr.rows[0]?.result;

  return query;
};


/* === selectOne === */

export interface SelectOneSignatures {
  <T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap>(
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
export const selectOne: SelectOneSignatures = function (
  table: any,
  where: any,
  options: any = {},
) {
  // you might argue that 'selectOne' offers little that you can't get with destructuring assignment 
  // and plain 'select' -- e.g. let [x] = async select(...).run(pool); -- but a thing that is definitely worth 
  // having is '| undefined' in the return signature, because the result of indexing never includes undefined
  // (see e.g. https://github.com/Microsoft/TypeScript/issues/13778)

  return select(table, where, options, SelectResultMode.One);
};


/* === count === */

export interface CountSignatures {
  <T extends Table>(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: { columns?: ColumnForTable<T>[], alias?: string },
  ): SQLFragment<number>;
}

/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be nested in 
 * other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted, or `all`
 * @param options Options object. Keys are: `columns`, `alias`.
 */
export const count: CountSignatures = function (
  table: any,
  where: any,
  options?: any,
) {

  return select(table, where, options, SelectResultMode.Count);
};
