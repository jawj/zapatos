
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
}


/* === upsert === */

interface UpsertAction { $action: 'INSERT' | 'UPDATE' };
type UpsertReturnableForTable<T extends Table> = JSONSelectableForTable<T> & UpsertAction;

interface UpsertSignatures {
  <T extends Table>(table: T, values: InsertableForTable<T>, uniqueCols: ColumnForTable<T> | ColumnForTable<T>[], noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>>;
  <T extends Table>(table: T, values: InsertableForTable<T>[], uniqueCols: ColumnForTable<T> | ColumnForTable<T>[], noNullUpdateCols?: ColumnForTable<T> | ColumnForTable<T>[]): SQLFragment<UpsertReturnableForTable<T>[]>;
}

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
}


/* === update === */

interface UpdateSignatures {
  <T extends Table>(table: T, values: UpdatableForTable<T>, where: WhereableForTable<T> | SQLFragment): SQLFragment<JSONSelectableForTable<T>[]>;
}

export const update: UpdateSignatures = function (
  table: Table,
  values: Updatable,
  where: Whereable | SQLFragment): SQLFragment {

  // note: the ROW() constructor below is required in Postgres 10+ if we're updating a single column
  // more info: https://www.postgresql-archive.org/Possible-regression-in-UPDATE-SET-lt-column-list-gt-lt-row-expression-gt-with-just-one-single-column0-td5989074.html

  const query = sql<SQL>`UPDATE ${table} SET (${cols(values)}) = ROW(${vals(values)}) WHERE ${where} RETURNING to_jsonb(${table}.*) AS result`;
  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
}


/* === delete === */

export interface DeleteSignatures {
  <T extends Table>(table: T, where: WhereableForTable<T> | SQLFragment): SQLFragment<JSONSelectableForTable<T>[]>;
}

export const deletes: DeleteSignatures = function  // sadly, delete is a reserved word
  (table: Table, where: Whereable | SQLFragment): SQLFragment {

  const query = sql<SQL>`DELETE FROM ${table} WHERE ${where} RETURNING to_jsonb(${table}.*) AS result`;
  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
}


/* === truncate === */

type TruncateIdentityOpts = 'CONTINUE IDENTITY' | 'RESTART IDENTITY';
type TruncateForeignKeyOpts = 'RESTRICT' | 'CASCADE';

interface TruncateSignatures {
  (table: Table | Table[], optId: TruncateIdentityOpts): SQLFragment<undefined>;
  (table: Table | Table[], optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
  (table: Table | Table[], optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
}

export const truncate: TruncateSignatures = function
  (table: Table | Table[], ...opts: string[]): SQLFragment<undefined> {

  if (!Array.isArray(table)) table = [table];
  const
    tables = mapWithSeparator(table, sql`, `, t => t),
    query = sql<SQL, undefined>`TRUNCATE ${tables}${raw((opts.length ? ' ' : '') + opts.join(' '))}`;

  return query;
}


/* === select === */

interface OrderSpecForTable<T extends Table> {
  by: SQLForTable<T>,
  direction: 'ASC' | 'DESC',
  nulls?: 'FIRST' | 'LAST',
}

export interface SelectOptionsForTable<T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap> {
  order?: OrderSpecForTable<T>[];
  limit?: number;
  offset?: number;
  columns?: C;
  extras?: E,
  lateral?: L;
  alias?: string;
}

export interface SQLFragmentsMap { [k: string]: SQLFragment<any> };
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

export enum SelectResultMode { Many, One, Count };

export interface SelectSignatures {
  <T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap, M extends SelectResultMode = SelectResultMode.Many> (
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
    mode?: M,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, M>>;
}

export const select: SelectSignatures = function (
  rawTable: Table,
  where: Whereable | SQLFragment | AllType = all,
  rawOptions: SelectOptionsForTable<Table, ColumnForTable<Table>[], SQLFragmentsMap, SQLFragmentsMap> = {},
  mode: SelectResultMode = SelectResultMode.Many,
) {

  const
    options = mode === SelectResultMode.One ? Object.assign({}, rawOptions, { limit: 1 }) : rawOptions,
    table = options.alias || rawTable,
    tableAliasSQL = table === rawTable ? [] : sql` AS ${table}`,
    colsSQL = mode === SelectResultMode.Count ?
      (options.columns ? sql`count(${cols(options.columns)})` : sql`count(${table}.*)`) :
      options.columns ?
        sql`jsonb_build_object(${mapWithSeparator(options.columns, sql`, `, c => raw(`'${c}', "${c}"`))})` :
        sql`to_jsonb(${table}.*)`,
    colsLateralSQL = options.lateral === undefined ? [] :
      sql` || jsonb_build_object(${mapWithSeparator(
        Object.keys(options.lateral), sql`, `, k => raw(`'${k}', "cj_${k}".result`))})`,
    colsExtraSQL = options.extras === undefined ? [] :
      sql` || jsonb_build_object(${mapWithSeparator(
        Object.keys(options.extras), sql`, `, k => [raw(`'${k}', `), options.extras![k]])})`,
    allColsSQL = sql`${colsSQL}${colsLateralSQL}${colsExtraSQL}`,
    whereSQL = where === all ? [] : [sql` WHERE `, where],
    orderSQL = !options.order ? [] :
      [sql` ORDER BY `, ...mapWithSeparator(options.order, sql`, `, o =>
        sql`${o.by} ${raw(o.direction)}${o.nulls ? sql` NULLS ${raw(o.nulls)}` : []}`)],
    limitSQL = options.limit === undefined ? [] : sql` LIMIT ${raw(String(options.limit))}`,
    offsetSQL = options.offset === undefined ? [] : sql` OFFSET ${raw(String(options.offset))}`,
    lateralSQL = options.lateral === undefined ? [] : Object.keys(options.lateral).map(k => {
      const subQ = options.lateral![k];
      subQ.parentTable = table;  // enables db.parent('column') in nested query Wherables
      return sql<SQL>` LEFT JOIN LATERAL (${subQ}) AS ${raw(`"cj_${k}"`)} ON true`;
    });

  const
    rowsQuery = sql<SQL, any>`SELECT ${allColsSQL} AS result FROM ${rawTable}${tableAliasSQL}${lateralSQL}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`,
    query = mode !== SelectResultMode.Many ? rowsQuery :
      // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
      sql<SQL, any>`SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${raw(`"sq_${table}"`)}`;

  query.runResultTransform = mode === SelectResultMode.Count ?
    // note: pg deliberately returns strings for int8 in case 64-bit numbers overflow
    // (see https://github.com/brianc/node-pg-types#use), but we assume counts aren't that big
    (qr) => Number(qr.rows[0].result) :
    (qr) => qr.rows[0]?.result;

  return query;
}


/* === selectOne === */

export interface SelectOneSignatures {
  <T extends Table, C extends ColumnForTable<T>[], L extends SQLFragmentsMap, E extends SQLFragmentsMap>(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.One>>;
}

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
}

export interface CountSignatures {
  <T extends Table>(table: T, where: WhereableForTable<T> | SQLFragment | AllType, options?: { columns?: ColumnForTable<T>[], alias?: string }): SQLFragment<number>;
}


/* === count === */

export const count: CountSignatures = function (
  table: any,
  where: any,
  options?: any,
) {

  return select(table, where, options, SelectResultMode.Count);
}
