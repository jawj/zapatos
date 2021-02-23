/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type {
  JSONSelectableForTable,
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
} from 'zapatos/schema';

import {
  AllType,
  all,
  SQL,
  SQLFragment,
  sql,
  cols,
  vals,
  raw,
  param,
  Default,
} from './core';

import {
  completeKeysWithDefaultValue,
  mapWithSeparator,
  PromisedType,
} from './utils';


export type JSONOnlyColsForTable<T extends Table, C extends any[] /* `ColumnForTable<T>[]` gives errors here for reasons I haven't got to the bottom of */> =
  Pick<JSONSelectableForTable<T>, C[number]>;

export interface SQLFragmentsMap { [k: string]: SQLFragment<any> }
export type PromisedSQLFragmentReturnType<R extends SQLFragment<any>> = PromisedType<ReturnType<R['run']>>;

// yes, the next two types are identical, but distinct names make complex inferred types more readable
export type LateralResult<L extends SQLFragmentsMap> = { [K in keyof L]: PromisedSQLFragmentReturnType<L[K]> };
export type ExtrasResult<L extends SQLFragmentsMap> = { [K in keyof L]: PromisedSQLFragmentReturnType<L[K]> };

type ExtrasOption = SQLFragmentsMap | undefined;
type ColumnsOption<T extends Table> = ColumnForTable<T>[] | undefined;

type LimitedLateralOption = SQLFragmentsMap | undefined;
type FullLateralOption = LimitedLateralOption | SQLFragment<any>;
type LateralOption<
  C extends ColumnsOption<Table>,
  E extends ExtrasOption,
  > =
  undefined extends C ? undefined extends E ? FullLateralOption : LimitedLateralOption : LimitedLateralOption;

export interface ReturningOptionsForTable<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption> {
  returning?: C;
  extras?: E;
};

type ReturningTypeForTable<T extends Table, C extends ColumnsOption<T>, E extends ExtrasOption> =
  (undefined extends C ? JSONSelectableForTable<T> :
    C extends ColumnForTable<T>[] ? JSONOnlyColsForTable<T, C> :
    never) &
  (undefined extends E ? {} :
    E extends SQLFragmentsMap ? ExtrasResult<E> :
    never);


function SQLForColumnsOfTable(columns: Column[] | undefined, table: Table) {
  return columns === undefined ? sql`to_jsonb(${table}.*)` :
    sql`jsonb_build_object(${mapWithSeparator(columns, sql`, `, c => sql`${param(c)}::text, ${c}`)})`;
}

function SQLForExtras(extras: SQLFragmentsMap | undefined) {
  return extras === undefined ? [] :
    sql` || jsonb_build_object(${mapWithSeparator(
      Object.keys(extras), sql`, `, k => sql`${param(k)}::text, ${extras[k]}`)})`;
}


/* === insert === */

interface InsertSignatures {
  <T extends Table, C extends ColumnForTable<T>[] | undefined, E extends SQLFragmentsMap | undefined>(
    table: T,
    values: InsertableForTable<T>,
    options?: ReturningOptionsForTable<T, C, E>
  ): SQLFragment<ReturningTypeForTable<T, C, E>>;

  <T extends Table, C extends ColumnForTable<T>[] | undefined, E extends SQLFragmentsMap | undefined>(
    table: T,
    values: InsertableForTable<T>[],
    options?: ReturningOptionsForTable<T, C, E>
  ): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
}

/**
 * Generate an `INSERT` query `SQLFragment`.
 * @param table The table into which to insert
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
export const insert: InsertSignatures = function (
  table: Table,
  values: Insertable | Insertable[],
  options?: ReturningOptionsForTable<Table, Column[] | undefined, SQLFragmentsMap | undefined>
): SQLFragment<any> {

  let query;
  if (Array.isArray(values) && values.length === 0) {
    query = sql`INSERT INTO ${table} SELECT null WHERE false`;
    query.noop = true;
    query.noopResult = [];

  } else {
    const
      completedValues = Array.isArray(values) ? completeKeysWithDefaultValue(values, Default) : values,
      colsSQL = cols(Array.isArray(completedValues) ? completedValues[0] : completedValues),
      valuesSQL = Array.isArray(completedValues) ?
        mapWithSeparator(completedValues as Insertable[], sql`, `, v => sql`(${vals(v)})`) :
        sql`(${vals(completedValues)})`,
      returningSQL = SQLForColumnsOfTable(options?.returning, table),
      extrasSQL = SQLForExtras(options?.extras);

    query = sql`INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} RETURNING ${returningSQL}${extrasSQL} AS result`;
  }

  query.runResultTransform = Array.isArray(values) ?
    (qr) => qr.rows.map(r => r.result) :
    (qr) => qr.rows[0].result;

  return query;
};


/* === upsert === */

/**
 * Wraps a unique index of the target table for use as the arbiter constraint
 * of an `upsert` shortcut query.
 */
export class Constraint<T extends Table> { constructor(public value: UniqueIndexForTable<T>) { } }
/**
 * Returns a `Constraint` instance, wrapping a unique index of the target table
 * for use as the arbiter constraint of an `upsert` shortcut query.
 */
export function constraint<T extends Table>(x: UniqueIndexForTable<T>) { return new Constraint<T>(x); }

export interface UpsertAction { $action: 'INSERT' | 'UPDATE' }

type UpsertReportAction = 'suppress';
type UpsertReturnableForTable<
  T extends Table,
  C extends ColumnForTable<T>[] | undefined,
  E extends SQLFragmentsMap | undefined,
  RA extends UpsertReportAction | undefined
  > =
  ReturningTypeForTable<T, C, E> & (undefined extends RA ? UpsertAction : {});

type UpsertConflictTargetForTable<T extends Table> = Constraint<T> | ColumnForTable<T> | ColumnForTable<T>[];
type UpdateColumns<T extends Table> = ColumnForTable<T> | ColumnForTable<T>[];

interface UpsertOptions<
  T extends Table,
  C extends ColumnForTable<T>[] | undefined,
  E extends SQLFragmentsMap | undefined,
  UC extends UpdateColumns<T> | undefined,
  RA extends UpsertReportAction | undefined,
  > extends ReturningOptionsForTable<T, C, E> {
  updateValues?: UpdatableForTable<T>;
  updateColumns?: UC;
  noNullUpdateColumns?: ColumnForTable<T> | ColumnForTable<T>[];
  reportAction?: RA;
}

interface UpsertSignatures {
  <T extends Table,
    C extends ColumnForTable<T>[] | undefined,
    E extends SQLFragmentsMap | undefined,
    UC extends UpdateColumns<T> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    table: T,
    values: InsertableForTable<T>,
    conflictTarget: UpsertConflictTargetForTable<T>,
    options?: UpsertOptions<T, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<T, C, E, RA> | (UC extends never[] ? undefined : never)>;

  <T extends Table,
    C extends ColumnForTable<T>[] | undefined,
    E extends SQLFragmentsMap | undefined,
    UC extends UpdateColumns<T> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    table: T,
    values: InsertableForTable<T>[],
    conflictTarget: UpsertConflictTargetForTable<T>,
    options?: UpsertOptions<T, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<T, C, E, RA>[]>;
}

export const doNothing = [];

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
export const upsert: UpsertSignatures = function (
  table: Table,
  values: Insertable | Insertable[],
  conflictTarget: Column | Column[] | Constraint<Table>,
  options?: UpsertOptions<Table, Column[] | undefined, SQLFragmentsMap | undefined, UpdateColumns<Table>, UpsertReportAction>
): SQLFragment<any> {

  if (Array.isArray(values) && values.length === 0) return insert(table, values);  // punt a no-op to plain insert
  if (typeof conflictTarget === 'string') conflictTarget = [conflictTarget];  // now either Column[] or Constraint

  let noNullUpdateColumns = options?.noNullUpdateColumns ?? [];
  if (!Array.isArray(noNullUpdateColumns)) noNullUpdateColumns = [noNullUpdateColumns];

  let specifiedUpdateColumns = options?.updateColumns;
  if (specifiedUpdateColumns && !Array.isArray(specifiedUpdateColumns)) specifiedUpdateColumns = [specifiedUpdateColumns];

  const
    completedValues = Array.isArray(values) ? completeKeysWithDefaultValue(values, Default) : [values],
    firstRow = completedValues[0],
    insertColsSQL = cols(firstRow),
    insertValuesSQL = mapWithSeparator(completedValues, sql`, `, v => sql`(${vals(v)})`),
    colNames = Object.keys(firstRow) as Column[],
    updateColumns = specifiedUpdateColumns as string[] ?? colNames,
    conflictTargetSQL = Array.isArray(conflictTarget) ?
      sql`(${mapWithSeparator(conflictTarget, sql`, `, c => c)})` :
      sql<string>`ON CONSTRAINT ${conflictTarget.value}`,
    updateColsSQL = mapWithSeparator(updateColumns, sql`, `, c => c),
    updateValues = options?.updateValues ?? {},
    updateValuesSQL = mapWithSeparator(updateColumns, sql`, `, c =>
      updateValues[c] !== undefined ? updateValues[c] :
        noNullUpdateColumns.includes(c) ? sql`CASE WHEN EXCLUDED.${c} IS NULL THEN ${table}.${c} ELSE EXCLUDED.${c} END` :
          sql`EXCLUDED.${c}`),
    returningSQL = SQLForColumnsOfTable(options?.returning, table),
    extrasSQL = SQLForExtras(options?.extras),
    suppressReport = options?.reportAction === 'suppress';

  // the added-on $action = 'INSERT' | 'UPDATE' key takes after SQL Server's approach to MERGE
  // (and on the use of xmax for this purpose, see: https://stackoverflow.com/questions/39058213/postgresql-upsert-differentiate-inserted-and-updated-rows-using-system-columns-x)

  const
    insertPart = sql`INSERT INTO ${table} (${insertColsSQL}) VALUES ${insertValuesSQL}`,
    conflictPart = sql`ON CONFLICT ${conflictTargetSQL} DO`,
    conflictActionPart = updateColsSQL.length > 0 ? sql`UPDATE SET (${updateColsSQL}) = ROW(${updateValuesSQL})` : sql`NOTHING`,
    reportPart = sql` || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END)`,
    returningPart = sql`RETURNING ${returningSQL}${extrasSQL}${suppressReport ? [] : reportPart} AS result`,
    query = sql`${insertPart} ${conflictPart} ${conflictActionPart} ${returningPart}`;

  query.runResultTransform = Array.isArray(values) ?
    (qr) => qr.rows.map(r => r.result) :
    (qr) => qr.rows[0]?.result;

  return query;
};


/* === update === */

interface UpdateSignatures {
  <T extends Table, C extends ColumnForTable<T>[] | undefined, E extends SQLFragmentsMap | undefined>(
    table: T,
    values: UpdatableForTable<T>,
    where: WhereableForTable<T> | SQLFragment,
    options?: ReturningOptionsForTable<T, C, E>
  ): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
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
  where: Whereable | SQLFragment,
  options?: ReturningOptionsForTable<Table, Column[] | undefined, SQLFragmentsMap | undefined>
): SQLFragment {

  // note: the ROW() constructor below is required in Postgres 10+ if we're updating a single column
  // more info: https://www.postgresql-archive.org/Possible-regression-in-UPDATE-SET-lt-column-list-gt-lt-row-expression-gt-with-just-one-single-column0-td5989074.html

  const
    returningSQL = SQLForColumnsOfTable(options?.returning, table),
    extrasSQL = SQLForExtras(options?.extras),
    query = sql`UPDATE ${table} SET (${cols(values)}) = ROW(${vals(values)}) WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;

  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
};


/* === delete === */

export interface DeleteSignatures {
  <T extends Table, C extends ColumnForTable<T>[] | undefined, E extends SQLFragmentsMap | undefined>(
    table: T,
    where: WhereableForTable<T> | SQLFragment,
    options?: ReturningOptionsForTable<T, C, E>
  ): SQLFragment<ReturningTypeForTable<T, C, E>[]>;
}

/**
 * Generate an `DELETE` query `SQLFragment` (plain 'delete' is a reserved word)
 * @param table The table to delete from
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to delete
 */
export const deletes: DeleteSignatures = function (
  table: Table,
  where: Whereable | SQLFragment,
  options?: ReturningOptionsForTable<Table, Column[] | undefined, SQLFragmentsMap | undefined>
): SQLFragment {

  const
    returningSQL = SQLForColumnsOfTable(options?.returning, table),
    extrasSQL = SQLForExtras(options?.extras),
    query = sql`DELETE FROM ${table} WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;

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
 * @param opts Options: 'CONTINUE IDENTITY'/'RESTART IDENTITY' and/or 
 * 'RESTRICT'/'CASCADE'
 */
export const truncate: TruncateSignatures = function (
  table: Table | Table[],
  ...opts: string[]
): SQLFragment<undefined> {

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
  C extends ColumnsOption<T>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption,
  > {
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
  alias?: string;
  lock?: SelectLockingOptions | SelectLockingOptions[];
};

type SelectReturnTypeForTable<
  T extends Table,
  C extends ColumnsOption<T>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption,
  > =
  (undefined extends L ? ReturningTypeForTable<T, C, E> :
    L extends SQLFragmentsMap ? ReturningTypeForTable<T, C, E> & LateralResult<L> :
    L extends SQLFragment<any> ? PromisedSQLFragmentReturnType<L> :
    never);

export enum SelectResultMode { Many, One, ExactlyOne, Count }

export type FullSelectReturnTypeForTable<
  T extends Table,
  C extends ColumnsOption<T>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption,
  M extends SelectResultMode,
  > =
  {
    [SelectResultMode.Many]: SelectReturnTypeForTable<T, C, L, E>[];
    [SelectResultMode.ExactlyOne]: SelectReturnTypeForTable<T, C, L, E>;
    [SelectResultMode.One]: SelectReturnTypeForTable<T, C, L, E> | undefined;
    [SelectResultMode.Count]: number;
  }[M];

export interface SelectSignatures {
  <T extends Table,
    C extends ColumnsOption<T>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption,
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
export const select: SelectSignatures = function (
  table: Table,
  where: Whereable | SQLFragment | AllType = all,
  options: SelectOptionsForTable<Table, ColumnsOption<Table>, LateralOption<ColumnsOption<Table>, ExtrasOption>, ExtrasOption> = {},
  mode: SelectResultMode = SelectResultMode.Many,
) {

  const
    limit1 = mode === SelectResultMode.One || mode === SelectResultMode.ExactlyOne,
    allOptions = limit1 ? { ...options, limit: 1 } : options,
    alias = allOptions.alias || table,
    { distinct, groupBy, having, lateral, columns, extras } = allOptions,
    lock = allOptions.lock === undefined || Array.isArray(allOptions.lock) ? allOptions.lock : [allOptions.lock],
    order = allOptions.order === undefined || Array.isArray(allOptions.order) ? allOptions.order : [allOptions.order],
    tableAliasSQL = alias === table ? [] : sql<string>` AS ${alias}`,
    distinctSQL = !distinct ? [] : sql` DISTINCT${distinct instanceof SQLFragment || typeof distinct === 'string' ? sql` ON (${distinct})` :
      Array.isArray(distinct) ? sql` ON (${cols(distinct)})` : []}`,
    colsSQL = lateral instanceof SQLFragment ? [] :
      mode === SelectResultMode.Count ?
        (columns ? sql`count(${cols(columns)})` : sql<typeof alias>`count(${alias}.*)`) :
        SQLForColumnsOfTable(columns, alias as Table),
    colsExtraSQL = lateral instanceof SQLFragment ? [] : SQLForExtras(extras),
    colsLateralSQL = lateral === undefined ? [] :
      lateral instanceof SQLFragment ? sql`"ljoin_passthru".result` :
        sql` || jsonb_build_object(${mapWithSeparator(
          Object.keys(lateral).sort(), sql`, `, (k, i) => sql`${param(k)}::text, "ljoin_${raw(String(i))}".result`)})`,
    allColsSQL = sql`${colsSQL}${colsExtraSQL}${colsLateralSQL}`,
    whereSQL = where === all ? [] : sql` WHERE ${where}`,
    groupBySQL = !groupBy ? [] : sql` GROUP BY ${groupBy instanceof SQLFragment || typeof groupBy === 'string' ? groupBy : cols(groupBy)}`,
    havingSQL = !having ? [] : sql` HAVING ${having}`,
    orderSQL = order === undefined ? [] :
      sql` ORDER BY ${mapWithSeparator(order as OrderSpecForTable<Table>[], sql`, `, o => {  // `as` clause is required when TS not strict
        if (!['ASC', 'DESC'].includes(o.direction)) throw new Error(`Direction must be ASC/DESC, not '${o.direction}'`);
        if (o.nulls && !['FIRST', 'LAST'].includes(o.nulls)) throw new Error(`Nulls must be FIRST/LAST/undefined, not '${o.nulls}'`);
        return sql`${o.by} ${raw(o.direction)}${o.nulls ? sql` NULLS ${raw(o.nulls)}` : []}`;
      })}`,
    offsetSQL = allOptions.offset === undefined ? [] : sql` OFFSET ${param(allOptions.offset)} ROWS`,
    limitSQL = allOptions.limit === undefined ? [] :
      sql` FETCH FIRST ${param(allOptions.limit)} ROWS ${allOptions.withTies ? sql`WITH TIES` : sql`ONLY`}`,
    lockSQL = lock === undefined ? [] : (lock as SelectLockingOptions[]).map(lock => {  // `as` clause is required when TS not strict
      const
        ofTables = lock.of === undefined || Array.isArray(lock.of) ? lock.of : [lock.of],
        ofClause = ofTables === undefined ? [] : sql` OF ${mapWithSeparator(ofTables as Table[], sql`, `, t => t)}`;  // `as` clause is required when TS not strict
      return sql` FOR ${raw(lock.for)}${ofClause}${lock.wait ? sql` ${raw(lock.wait)}` : []}`;
    }),
    lateralSQL = lateral === undefined ? [] :
      lateral instanceof SQLFragment ? (() => {
        lateral.parentTable = alias;
        return sql` LEFT JOIN LATERAL (${lateral}) AS "ljoin_passthru" ON true`;
      })() :
        Object.keys(lateral).sort().map((k, i) => {
          const subQ = lateral[k];
          subQ.parentTable = alias;  // enables `parent('column')` in subquery's Wherables
          return sql` LEFT JOIN LATERAL (${subQ}) AS "ljoin_${raw(String(i))}" ON true`;
        });

  const
    rowsQuery = sql<SQL, any>`SELECT${distinctSQL} ${allColsSQL} AS result FROM ${table}${tableAliasSQL}${lateralSQL}${whereSQL}${groupBySQL}${havingSQL}${orderSQL}${offsetSQL}${limitSQL}${lockSQL}`,
    query = mode !== SelectResultMode.Many ? rowsQuery :
      // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
      sql<SQL, any>`SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${raw(`"sq_${alias}"`)}`;

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
        } : // SelectResultMode.One or SelectResultMode.Many
        (qr) => qr.rows[0]?.result;

  return query;
};


/* === selectOne === */

export interface SelectOneSignatures {
  <
    T extends Table,
    C extends ColumnsOption<T>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption,
    >(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.One>>;
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
export const selectOne: SelectOneSignatures = function (table, where, options = {}) {
  // you might argue that 'selectOne' offers little that you can't get with 
  // destructuring assignment and plain 'select' 
  // -- e.g.let[x] = async select(...).run(pool); -- but something worth having
  // is '| undefined' in the return signature, because the result of indexing 
  // never includes undefined (until 4.1 and --noUncheckedIndexedAccess)
  // (see https://github.com/Microsoft/TypeScript/issues/13778)

  return select(table, where, options, SelectResultMode.One);
};


/* === selectExactlyOne === */

export interface SelectExactlyOneSignatures {
  <
    T extends Table,
    C extends ColumnsOption<T>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption,
    >(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: SelectOptionsForTable<T, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<T, C, L, E, SelectResultMode.ExactlyOne>>;
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

export const selectExactlyOne: SelectExactlyOneSignatures = function (table, where, options = {}) {
  return select(table, where, options, SelectResultMode.ExactlyOne);
};


/* === count === */

export interface CountSignatures {
  <T extends Table>(
    table: T,
    where: WhereableForTable<T> | SQLFragment | AllType,
    options?: { columns?: ColumnsOption<T>; alias?: string },
  ): SQLFragment<number>;
}

/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be 
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted, 
 * or `all`
 * @param options Options object. Keys are: `columns`, `alias`.
 */
export const count: CountSignatures = function (table, where, options?) {
  return select(table, where, options, SelectResultMode.Count);
};
