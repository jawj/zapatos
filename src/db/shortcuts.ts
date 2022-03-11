/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import {
  AllType,
  all,
  GenericSQL,
  GenericSQLStructure,
  SQLForStructure,
  SQLStructure,
  SQLFragment,
  sql,
  cols,
  vals,
  raw,
  param,
  Default,
  Column
} from './core';

import {
  completeKeysWithDefaultValue,
  mapWithSeparator,
} from './utils';


export type JSONColumn <S extends GenericSQLStructure> = Exclude<keyof S['JSONSelectable'], number | symbol>;
export type JSONOnlyColsForTable<S extends GenericSQLStructure, C extends JSONColumn<S>[]> =
  Pick<S['JSONSelectable'], C[number]>;

export interface SQLFragmentMap { [k: string]: SQLFragment<any> }
export interface SQLFragmentOrColumnMap<S extends GenericSQLStructure> { [k: string]: SQLFragment<any> | Column<S> }
export type RunResultForSQLFragment<T extends SQLFragment<any, any>> = T extends SQLFragment<infer RunResult, any> ? RunResult : never;

export type LateralResult<L extends SQLFragmentMap> = { [K in keyof L]: RunResultForSQLFragment<L[K]> };
export type ExtrasResult<S extends GenericSQLStructure, E extends SQLFragmentOrColumnMap<S>> = { [K in keyof E]:
  E[K] extends SQLFragment<any> ? RunResultForSQLFragment<E[K]> : E[K] extends keyof S['JSONSelectable'] ? S['JSONSelectable'][E[K]] : never;
};

type ExtrasOption<S extends GenericSQLStructure> = SQLFragmentOrColumnMap<S> | undefined;
type ColumnsOption<S extends GenericSQLStructure> = Column<S>[] | undefined;

type LimitedLateralOption = SQLFragmentMap | undefined;
type FullLateralOption = LimitedLateralOption | SQLFragment<any>;
type LateralOption<
  C extends ColumnsOption<GenericSQLStructure>,
  E extends ExtrasOption<GenericSQLStructure>,
  > =
  undefined extends C ? undefined extends E ? FullLateralOption : LimitedLateralOption : LimitedLateralOption;

export interface ReturningOptionsForTable<S extends GenericSQLStructure, C extends ColumnsOption<S>, E extends ExtrasOption<S>> {
  returning?: C;
  extras?: E;
};

type ReturningTypeForTable<S extends GenericSQLStructure, C extends JSONColumn<S>[] | undefined, E extends ExtrasOption<S>> =
  (undefined extends C ? S['JSONSelectable'] :
    C extends JSONColumn<S>[] ? JSONOnlyColsForTable<S, C> :
    never) &
  (undefined extends E ? {} :
    E extends SQLFragmentOrColumnMap<S> ? ExtrasResult<S, E> :
    never);


function SQLForColumnsOfTable(columns: Column<GenericSQLStructure>[] | undefined, table: GenericSQLStructure['Table']) {
  return columns === undefined ? sql`to_jsonb(${table}.*)` :
    sql`jsonb_build_object(${mapWithSeparator(columns, sql`, `, c => sql`${param(c)}::text, ${c}`)})`;
}

function SQLForExtras<S extends GenericSQLStructure>(extras: ExtrasOption<S>) {
  return extras === undefined ? [] :
    sql` || jsonb_build_object(${mapWithSeparator(
      Object.keys(extras), sql`, `, k => sql`${param(k)}::text, ${extras[k]}`)})`;
}


/* === insert === */

interface InsertSignatures <BaseSQLStructure extends GenericSQLStructure> {
  <T extends BaseSQLStructure['Table'], S extends Extract<BaseSQLStructure, { Table: T }>, C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    table: T,
    values: S['Insertable'],
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>>;

  <T extends BaseSQLStructure['Table'], S extends Extract<BaseSQLStructure, { Table: T }>, C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    table: T,
    values: S['Insertable'][],
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;
}

const genericInsert = (
  table: GenericSQLStructure['Table'],
  values: GenericSQLStructure['Insertable'] | GenericSQLStructure['Insertable'][],
  options?: ReturningOptionsForTable<GenericSQLStructure, ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>
): SQLFragment<any> => {

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
        mapWithSeparator(completedValues as GenericSQLStructure['Insertable'][], sql`, `, v => sql`(${vals(v)})`) :
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

/**
 * Generate an `INSERT` query `SQLFragment`.
 * @param table The table into which to insert
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
export const insert: InsertSignatures<SQLStructure> = genericInsert;


/* === upsert === */

/**
 * Wraps a unique index of the target table for use as the arbiter constraint
 * of an `upsert` shortcut query.
 */
export class Constraint<S extends GenericSQLStructure> { constructor(public value: S['UniqueIndex']) { } }
/**
 * Returns a `Constraint` instance, wrapping a unique index of the target table
 * for use as the arbiter constraint of an `upsert` shortcut query.
 */
export function constraint<S extends GenericSQLStructure>(x: S['UniqueIndex']) { return new Constraint<S>(x); }

export interface UpsertAction { $action: 'INSERT' | 'UPDATE' }

type UpsertReportAction = 'suppress';
type UpsertReturnableForTable<
  S extends GenericSQLStructure,
  C extends ColumnsOption<S>,
  E extends ExtrasOption<S>,
  RA extends UpsertReportAction | undefined
  > =
  ReturningTypeForTable<S, C, E> & (undefined extends RA ? UpsertAction : {});

type UpsertConflictTargetForStructure<S extends GenericSQLStructure> = Constraint<S> | Column<S> | Column<S>[];
type UpdateColumns<S extends GenericSQLStructure> = Column<S> | Column<S>[];

interface UpsertOptions<
  S extends GenericSQLStructure,
  C extends ColumnsOption<S>,
  E extends ExtrasOption<S>,
  UC extends UpdateColumns<S> | undefined,
  RA extends UpsertReportAction | undefined,
  > extends ReturningOptionsForTable<S, C, E> {
  updateValues?: S['Updatable'];
  updateColumns?: UC;
  noNullUpdateColumns?: Column<S> | Column<S>[];
  reportAction?: RA;
}

interface UpsertSignatures <BaseSQLStructure extends GenericSQLStructure> {
  <T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    C extends ColumnsOption<S>,
    E extends ExtrasOption<S>,
    UC extends UpdateColumns<S> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    table: T,
    values: S['Insertable'],
    conflictTarget: UpsertConflictTargetForStructure<S>,
    options?: UpsertOptions<S, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<S, C, E, RA> | (UC extends never[] ? undefined : never)>;

  <T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    C extends ColumnsOption<S>,
    E extends ExtrasOption<S>,
    UC extends UpdateColumns<S> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    table: T,
    values: S['Insertable'][],
    conflictTarget: UpsertConflictTargetForStructure<S>,
    options?: UpsertOptions<S, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<S, C, E, RA>[]>;
}

export const doNothing = [];

const genericUpsert = function (
  table: GenericSQLStructure['Table'],
  values: GenericSQLStructure['Insertable'] | GenericSQLStructure['Insertable'][],
  conflictTarget: Column<GenericSQLStructure> | Column<GenericSQLStructure>[] | Constraint<GenericSQLStructure>,
  options?: UpsertOptions<any, ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>, UpdateColumns<GenericSQLStructure>, UpsertReportAction>
): SQLFragment<any> {

  if (Array.isArray(values) && values.length === 0) return genericInsert(table, values);  // punt a no-op to plain insert
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
    colNames = Object.keys(firstRow) as Column<GenericSQLStructure>[],
    updateColumns = specifiedUpdateColumns as string[] ?? colNames,
    conflictTargetSQL = Array.isArray(conflictTarget) ?
      sql`(${mapWithSeparator(conflictTarget, sql`, `, c => c)})` :
      sql<string>`ON CONSTRAINT ${conflictTarget.value}`,
    updateColsSQL = mapWithSeparator(updateColumns, sql`, `, c => c),
    updateValues = options?.updateValues ?? {},
    updateValuesSQL = mapWithSeparator(updateColumns, sql`, `, c =>
      (updateValues as { [k: string]: any })[c] !== undefined
        ? (updateValues as { [k: string]: any })[c]
        : noNullUpdateColumns.includes(c)
          ? sql`CASE WHEN EXCLUDED.${c} IS NULL THEN ${table}.${c} ELSE EXCLUDED.${c} END`
          : sql`EXCLUDED.${c}`),
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
export const upsert: UpsertSignatures<SQLStructure> = genericUpsert;


/* === update === */

interface UpdateSignatures <BaseSQLStructure extends GenericSQLStructure> {
  <T extends BaseSQLStructure['Table'], S extends Extract<BaseSQLStructure, { Table: T }>, C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    table: T,
    values: S['Updatable'],
    where: S['Whereable'] | SQLFragment,
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;
}

const genericUpdate = function (
  table: GenericSQLStructure['Table'],
  values: GenericSQLStructure['Updatable'],
  where: GenericSQLStructure['Whereable'] | SQLFragment,
  options?: ReturningOptionsForTable<GenericSQLStructure, ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>
): SQLFragment {

  // note: the ROW() constructor below is required in Postgres 10+ if we're updating a single column
  // more info: https://www.postgresql-archive.org/Possible-regression-in-UPDATE-SET-lt-column-list-gt-lt-row-expression-gt-with-just-one-single-column0-td5989074.html

  const
    returningSQL = SQLForColumnsOfTable(options?.returning, table),
    extrasSQL = SQLForExtras(options?.extras),
    query = sql<GenericSQL>`UPDATE ${table} SET (${cols(values)}) = ROW(${vals(values)}) WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;

  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
};

/**
 * Generate an `UPDATE` query `SQLFragment`.
 * @param table The table to update
 * @param values An `Updatable` of the new values with which to update the table
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to update
 */
export const update: UpdateSignatures<SQLStructure> = genericUpdate;


/* === delete === */

export interface DeleteSignatures <BaseSQLStructure extends GenericSQLStructure> {
  <T extends BaseSQLStructure['Table'], S extends Extract<BaseSQLStructure, { Table: T }>, C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    table: T,
    where: S['Whereable'] | SQLFragment,
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;
}

const genericDeletes = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment,
  options?: ReturningOptionsForTable<GenericSQLStructure, ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>
): SQLFragment {

  const
    returningSQL = SQLForColumnsOfTable(options?.returning, table),
    extrasSQL = SQLForExtras(options?.extras),
    query = sql<GenericSQL>`DELETE FROM ${table} WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;

  query.runResultTransform = (qr) => qr.rows.map(r => r.result);
  return query;
};

/**
 * Generate an `DELETE` query `SQLFragment` (plain 'delete' is a reserved word)
 * @param table The table to delete from
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to delete
 */
export const deletes: DeleteSignatures<SQLStructure> = genericDeletes;


/* === truncate === */

type TruncateIdentityOpts = 'CONTINUE IDENTITY' | 'RESTART IDENTITY';
type TruncateForeignKeyOpts = 'RESTRICT' | 'CASCADE';

interface TruncateSignatures <BaseSQLStructure extends GenericSQLStructure> {
  <T extends BaseSQLStructure['Table']>(table: T | readonly T[]): SQLFragment<undefined>;
  <T extends BaseSQLStructure['Table']>(table: T | readonly T[], optId: TruncateIdentityOpts): SQLFragment<undefined>;
  <T extends BaseSQLStructure['Table']>(table: T | readonly T[], optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
  <T extends BaseSQLStructure['Table']>(table: T | readonly T[], optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
}

const genericTruncate = function (
  table: GenericSQLStructure['Table'] | readonly GenericSQLStructure['Table'][],
  ...opts: string[]
): SQLFragment<undefined> {

  const tables = Array.isArray(table) ? table : [table];
  const
    formattedTables = mapWithSeparator(tables, sql`, `, t => t),
    query = sql<GenericSQL, undefined>`TRUNCATE ${formattedTables}${raw((opts.length ? ' ' : '') + opts.join(' '))}`;

  return query;
};

/**
 * Generate a `TRUNCATE` query `SQLFragment`.
 * @param table The table (or array thereof) to truncate
 * @param opts Options: 'CONTINUE IDENTITY'/'RESTART IDENTITY' and/or 
 * 'RESTRICT'/'CASCADE'
 */
export const truncate: TruncateSignatures<SQLStructure> = genericTruncate;


/* === select === */

interface OrderSpecForTable<S extends GenericSQLStructure> {
  by: SQLForStructure<S>;
  direction: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface SelectLockingOptions<O extends GenericSQLStructure> {
  for: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
  of?: O['Table'] | O['Table'][];
  wait?: 'NOWAIT' | 'SKIP LOCKED';
}

export interface SelectOptionsForTable<
  S extends GenericSQLStructure,
  O extends GenericSQLStructure,
  C extends ColumnsOption<S>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption<S>,
  > {
  distinct?: boolean | Column<S> | Column<S>[] | SQLFragment<any>;
  order?: OrderSpecForTable<S> | OrderSpecForTable<S>[];
  limit?: number;
  offset?: number;
  withTies?: boolean;
  columns?: C;
  extras?: E;
  groupBy?: Column<S> | Column<S>[] | SQLFragment<any>;
  having?: S['Whereable'] | SQLFragment<any>;
  lateral?: L;
  alias?: string;
  lock?: SelectLockingOptions<O> | SelectLockingOptions<O>[];
};

type SelectReturnTypeForTable<
  S extends GenericSQLStructure,
  C extends ColumnsOption<S>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption<S>,
  > =
  (undefined extends L ? ReturningTypeForTable<S, C, E> :
    L extends SQLFragmentMap ? ReturningTypeForTable<S, C, E> & LateralResult<L> :
    L extends SQLFragment<any> ? RunResultForSQLFragment<L> :
    never);

export enum SelectResultMode { Many, One, ExactlyOne, Numeric }

export type FullSelectReturnTypeForTable<
  S extends GenericSQLStructure,
  C extends ColumnsOption<S>,
  L extends LateralOption<C, E>,
  E extends ExtrasOption<S>,
  M extends SelectResultMode,
  > =
  {
    [SelectResultMode.Many]: SelectReturnTypeForTable<S, C, L, E>[];
    [SelectResultMode.ExactlyOne]: SelectReturnTypeForTable<S, C, L, E>;
    [SelectResultMode.One]: SelectReturnTypeForTable<S, C, L, E> | undefined;
    [SelectResultMode.Numeric]: number;
  }[M];

export interface SelectSignatures <
  BaseSQLStructure extends GenericSQLStructure,
  OtherSQLStructure extends GenericSQLStructure
  > {
  <T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    O extends OtherSQLStructure,
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    M extends SelectResultMode = SelectResultMode.Many
    >(
    table: T,
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
    mode?: M,
    aggregate?: string,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, M>>;
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

const genericSelect = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType = all,
  options: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>> = {},
  mode: SelectResultMode = SelectResultMode.Many,
  aggregate: string = 'count',
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
      mode === SelectResultMode.Numeric ?
        (columns ? sql`${raw(aggregate)}(${cols(columns)})` : sql`${raw(aggregate)}(${alias}.*)`) :
        SQLForColumnsOfTable(columns, alias as GenericSQLStructure['Table']),
    colsExtraSQL = lateral instanceof SQLFragment || mode === SelectResultMode.Numeric ? [] : SQLForExtras(extras),
    colsLateralSQL = lateral === undefined || mode === SelectResultMode.Numeric ? [] :
      lateral instanceof SQLFragment ? sql`"lateral_passthru".result` :
        sql` || jsonb_build_object(${mapWithSeparator(
          Object.keys(lateral).sort(), sql`, `, k => sql`${param(k)}::text, "lateral_${raw(k)}".result`)})`,
    allColsSQL = sql`${colsSQL}${colsExtraSQL}${colsLateralSQL}`,
    whereSQL = where === all ? [] : sql<GenericSQL>` WHERE ${where}`,
    groupBySQL = !groupBy ? [] : sql` GROUP BY ${groupBy instanceof SQLFragment || typeof groupBy === 'string' ? groupBy : cols(groupBy)}`,
    havingSQL = !having ? [] : sql` HAVING ${having}`,
    orderSQL = order === undefined ? [] :
      sql` ORDER BY ${mapWithSeparator(order as OrderSpecForTable<GenericSQLStructure>[], sql`, `, o => {  // `as` clause is required when TS not strict
        if (!['ASC', 'DESC'].includes(o.direction)) throw new Error(`Direction must be ASC/DESC, not '${o.direction}'`);
        if (o.nulls && !['FIRST', 'LAST'].includes(o.nulls)) throw new Error(`Nulls must be FIRST/LAST/undefined, not '${o.nulls}'`);
        return sql<GenericSQL>`${o.by} ${raw(o.direction)}${o.nulls ? sql` NULLS ${raw(o.nulls)}` : []}`;
      })}`,
    limitSQL = allOptions.limit === undefined ? [] :
      allOptions.withTies ? sql` FETCH FIRST ${param(allOptions.limit)} ROWS WITH TIES` :
        sql` LIMIT ${param(allOptions.limit)}`,  // compatibility with pg pre-10.5; and fewer bytes!
    offsetSQL = allOptions.offset === undefined ? [] : sql` OFFSET ${param(allOptions.offset)}`,  // pg is lax about OFFSET following FETCH, and we exploit that
    lockSQL = lock === undefined ? [] : (lock as SelectLockingOptions<GenericSQLStructure>[]).map(lock => {  // `as` clause is required when TS not strict
      const
        ofTables = lock.of === undefined || Array.isArray(lock.of) ? lock.of : [lock.of],
        ofClause = ofTables === undefined ? [] : sql` OF ${mapWithSeparator(ofTables as GenericSQLStructure['Table'][], sql`, `, t => t)}`;  // `as` clause is required when TS not strict
      return sql` FOR ${raw(lock.for)}${ofClause}${lock.wait ? sql` ${raw(lock.wait)}` : []}`;
    }),
    lateralSQL = lateral === undefined ? [] :
      lateral instanceof SQLFragment ? (() => {
        lateral.parentTable = alias;
        return sql` LEFT JOIN LATERAL (${lateral}) AS "lateral_passthru" ON true`;
      })() :
        Object.keys(lateral).sort().map(k => {
          const subQ = lateral[k];
          subQ.parentTable = alias;  // enables `parent('column')` in subquery's Wherables
          return sql` LEFT JOIN LATERAL (${subQ}) AS "lateral_${raw(k)}" ON true`;
        });

  const
    rowsQuery = sql<GenericSQL, any>`SELECT${distinctSQL} ${allColsSQL} AS result FROM ${table}${tableAliasSQL}${lateralSQL}${whereSQL}${groupBySQL}${havingSQL}${orderSQL}${limitSQL}${offsetSQL}${lockSQL}`,
    query = mode !== SelectResultMode.Many ? rowsQuery :
      // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
      sql<GenericSQL, any>`SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${raw(`"sq_${alias}"`)}`;

  query.runResultTransform =

    mode === SelectResultMode.Numeric ?
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

export const select: SelectSignatures<SQLStructure, SQLStructure> = genericSelect;


/* === selectOne === */

export interface SelectOneSignatures <
  BaseSQLStructure extends GenericSQLStructure,
  OtherSQLStructure extends GenericSQLStructure
  > {
  <
    T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    O extends OtherSQLStructure,
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    table: T,
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, SelectResultMode.One>>;
}

const genericSelectOne = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>> = {}
): SQLFragment<any> {
  // you might argue that 'selectOne' offers little that you can't get with 
  // destructuring assignment and plain 'select' 
  // -- e.g.let[x] = async select(...).run(pool); -- but something worth having
  // is '| undefined' in the return signature, because the result of indexing 
  // never includes undefined (until 4.1 and --noUncheckedIndexedAccess)
  // (see https://github.com/Microsoft/TypeScript/issues/13778)

  return genericSelect(table, where, options, SelectResultMode.One);
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns only a single result (or 
 * undefined). A `LIMIT 1` clause is added automatically. This can be nested with 
 * other `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. See documentation for `select` for details.
 */
export const selectOne: SelectOneSignatures<SQLStructure, SQLStructure> = genericSelectOne;


/* === selectExactlyOne === */

export interface SelectExactlyOneSignatures <
  BaseSQLStructure extends GenericSQLStructure,
  OtherSQLStructure extends GenericSQLStructure
  > {
  <
    T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    O extends OtherSQLStructure,
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    table: T,
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, SelectResultMode.ExactlyOne>>;
}

export const genericSelectExactlyOne = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>> = {}
): SQLFragment<any> {
  return genericSelect(table, where, options, SelectResultMode.ExactlyOne);
};

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

export const selectExactlyOne: SelectExactlyOneSignatures<SQLStructure, SQLStructure> = genericSelectExactlyOne;


/* === count, sum, avg === */

export interface NumericAggregateSignatures <
  BaseSQLStructure extends GenericSQLStructure,
  OtherSQLStructure extends GenericSQLStructure
  > {
  <
    T extends BaseSQLStructure['Table'],
    S extends Extract<BaseSQLStructure, { Table: T }>,
    O extends OtherSQLStructure,
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    table: T,
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<number>;
}

export const genericCount = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options?: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>>
) {
  return genericSelect(table, where, options, SelectResultMode.Numeric);
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be 
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted, 
 * or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export const count: NumericAggregateSignatures<SQLStructure, SQLStructure> = genericCount;

export const genericSum = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options?: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>>
) {
  return genericSelect(table, where, options, SelectResultMode.Numeric, 'sum');
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns a sum. This can be 
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export const sum: NumericAggregateSignatures<SQLStructure, SQLStructure> = genericSum;

export const genericAvg = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options?: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>>
) {
  return genericSelect(table, where, options, SelectResultMode.Numeric, 'avg');
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns an arithmetic mean via
 * the `avg` aggregate function. This can be nested in other `select`/
 * `selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export const avg: NumericAggregateSignatures<SQLStructure, SQLStructure> = genericAvg;

export const genericMin = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options?: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>>
) {
  return genericSelect(table, where, options, SelectResultMode.Numeric, 'min');
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns a minimum via the `min`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be 
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export const min: NumericAggregateSignatures<SQLStructure, SQLStructure> = genericMin;

export const genericMax = function (
  table: GenericSQLStructure['Table'],
  where: GenericSQLStructure['Whereable'] | SQLFragment | AllType,
  options?: SelectOptionsForTable<any, GenericSQLStructure, ColumnsOption<GenericSQLStructure>, LateralOption<ColumnsOption<GenericSQLStructure>, ExtrasOption<GenericSQLStructure>>, ExtrasOption<GenericSQLStructure>>
) {
  return genericSelect(table, where, options, SelectResultMode.Numeric, 'max');
};

/**
 * Generate a `SELECT` query `SQLFragment` that returns a maximum via the `max`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
export const max: NumericAggregateSignatures<SQLStructure, SQLStructure> = genericMax;


/* === table, tables === */

/*
 * To allow partial type argument inference, split shortcuts into 2 chained
 * functions. The first part (table) uses overridable type arguments and
 * the second one (insert, select, ...) uses type arguments for inference.
 * https://github.com/microsoft/TypeScript/issues/26242
 */

interface TableNumericAggregateSignatures <
  S extends GenericSQLStructure,
  O extends GenericSQLStructure
  > {
  <
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<number>;
}

interface TableReturn <
  S extends GenericSQLStructure,
  O extends GenericSQLStructure
> {
  insert<C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    values: S['Insertable'],
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>>;

  insert<C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    values: S['Insertable'][],
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;

  upsert<
    C extends ColumnsOption<S>,
    E extends ExtrasOption<S>,
    UC extends UpdateColumns<S> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    values: S['Insertable'],
    conflictTarget: UpsertConflictTargetForStructure<S>,
    options?: UpsertOptions<S, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<S, C, E, RA> | (UC extends never[] ? undefined : never)>;

  upsert<
    C extends ColumnsOption<S>,
    E extends ExtrasOption<S>,
    UC extends UpdateColumns<S> | undefined,
    RA extends UpsertReportAction | undefined
    >(
    values: S['Insertable'][],
    conflictTarget: UpsertConflictTargetForStructure<S>,
    options?: UpsertOptions<S, C, E, UC, RA>
  ): SQLFragment<UpsertReturnableForTable<S, C, E, RA>[]>;

  update<C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    values: S['Updatable'],
    where: S['Whereable'] | SQLFragment,
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;

  deletes<C extends ColumnsOption<S>, E extends ExtrasOption<S>>(
    where: S['Whereable'] | SQLFragment,
    options?: ReturningOptionsForTable<S, C, E>
  ): SQLFragment<ReturningTypeForTable<S, C, E>[]>;

  truncate(): SQLFragment<undefined>;
  truncate(optId: TruncateIdentityOpts): SQLFragment<undefined>;
  truncate(optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
  truncate(optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;

  select<C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    M extends SelectResultMode = SelectResultMode.Many
    >(
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
    mode?: M,
    aggregate?: string,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, M>>;

  selectOne<
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, SelectResultMode.One>>;

  selectExactlyOne<
    C extends ColumnsOption<S>,
    L extends LateralOption<C, E>,
    E extends ExtrasOption<S>,
    >(
    where: S['Whereable'] | SQLFragment | AllType,
    options?: SelectOptionsForTable<S, O, C, L, E>,
  ): SQLFragment<FullSelectReturnTypeForTable<S, C, L, E, SelectResultMode.ExactlyOne>>;

  count: TableNumericAggregateSignatures<S, O>;
  sum: TableNumericAggregateSignatures<S, O>;
  avg: TableNumericAggregateSignatures<S, O>;
  max: TableNumericAggregateSignatures<S, O>;
  min: TableNumericAggregateSignatures<S, O>;
}

interface TableSignatures {
  <
    T extends SQLStructure['Table']
    >(
    tables: T
  ): TableReturn<Extract<SQLStructure, { Table: T }>, SQLStructure>;

  <
    S extends GenericSQLStructure,
    O extends GenericSQLStructure = SQLStructure
    >(
    tables: S['Table']
  ): TableReturn<S, O>;
}

interface TablesReturn {
  truncate(): SQLFragment<undefined>;
  truncate(optId: TruncateIdentityOpts): SQLFragment<undefined>;
  truncate(optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
  truncate(optId: TruncateIdentityOpts, optFK: TruncateForeignKeyOpts): SQLFragment<undefined>;
}

interface TablesSignatures {
  <S extends GenericSQLStructure = SQLStructure>(tables: readonly S['Table'][]): TablesReturn;
}

/**
 * Creates a query generator for the specified table. Allows manual override of
 * type arguments.
 * @param table The table to query
 */
export const table: TableSignatures & TablesSignatures = (
  table: GenericSQLStructure['Table'] | readonly GenericSQLStructure['Table'][]
): TableReturn<GenericSQLStructure, GenericSQLStructure> & TablesReturn => {
  return {
    insert: genericInsert.bind(undefined, table as GenericSQLStructure['Table']),
    upsert: genericUpsert.bind(undefined, table as GenericSQLStructure['Table']),
    update: genericUpdate.bind(undefined, table as GenericSQLStructure['Table']),
    deletes: genericDeletes.bind(undefined, table as GenericSQLStructure['Table']),
    truncate: genericTruncate.bind(undefined, table),
    select: genericSelect.bind(undefined, table as GenericSQLStructure['Table']),
    selectOne: genericSelectOne.bind(undefined, table as GenericSQLStructure['Table']),
    selectExactlyOne: genericSelectExactlyOne.bind(undefined, table as GenericSQLStructure['Table']),
    count: genericCount.bind(undefined, table as GenericSQLStructure['Table']),
    sum: genericSum.bind(undefined, table as GenericSQLStructure['Table']),
    avg: genericAvg.bind(undefined, table as GenericSQLStructure['Table']),
    min: genericMin.bind(undefined, table as GenericSQLStructure['Table']),
    max: genericMax.bind(undefined, table as GenericSQLStructure['Table'])
  };
};
