/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as pg from 'pg';
import { tsTypeForPgType } from './pgTypes';
import type { EnumData } from './enums';
import type { CustomTypes } from './tsOutput';
import { CompleteConfig } from './config';

export interface TableMeta {
  tableName: string;
  tableType: string;
}

export const tablesInSchema = async (schemaName: string, pool: pg.Pool): Promise<TableMeta[]> => {
  const { rows } = await pool.query({
    text: `
      SELECT "table_name", 'table'::TEXT AS table_type
      FROM "information_schema"."columns"
      WHERE "table_schema" = $1 
      GROUP BY "table_name" ORDER BY lower("table_name")`,
    values: [schemaName]
  });

  const { rows: rowsV } = await pool.query({
    text: `
      SELECT
          pg_class.relname AS table_name
        , 'materialized view'::TEXT AS table_type

      FROM pg_catalog.pg_class

      INNER JOIN pg_catalog.pg_namespace ON pg_class.relnamespace = pg_namespace.oid

      WHERE pg_class.relkind = 'm'
        AND pg_namespace.nspname = $1
    `,
    values: [schemaName]
  });

  return rows.concat(rowsV).map(r => ({
    tableName: r.table_name,
    tableType: r.table_type,
  }));
};

const columnsForTable = async(
  table: TableMeta,
  schemaName: string,
  pool: pg.Pool,
) => {
  const
    { rows } = await pool.query({
      text: `
        SELECT
          "column_name" AS "column"
        , "is_nullable" = 'YES' AS "isNullable"
        , "is_generated" = 'ALWAYS' OR "identity_generation" = 'ALWAYS' AS "isGenerated"
        , "column_default" IS NOT NULL OR "identity_generation" = 'BY DEFAULT' AS "hasDefault"
        , "udt_name" AS "udtName"
        , "domain_name" AS "domainName"
        FROM "information_schema"."columns"
        WHERE "table_name" = $1 AND "table_schema" = $2`,
      values: [table.tableName, schemaName]
    });

  return rows;
};

const columnsForMaterializedView = async(
  table: TableMeta,
  schemaName: string,
  pool: pg.Pool,
) => {
  const
    { rows } = await pool.query({
      text: `
        SELECT
          a.attname AS "column"
        , a.attnotnull = 'f' AS "isNullable"
        , 't' AS "isGenerated" -- You can't write to materalized views
        , 'f' AS "hasDefault"
        , pg_catalog.format_type(a.atttypid, a.atttypmod) AS "udtName"
        , '?' AS "domainName"

      FROM pg_catalog.pg_class

      INNER JOIN pg_catalog.pg_attribute a ON pg_class.oid = a.attrelid
      INNER JOIN pg_catalog.pg_namespace n ON pg_class.relnamespace = n.oid

      WHERE pg_class.relkind = 'm'
        AND a.attnum >= 1
        AND pg_class.relname = $1
        AND n.nspname = $2
      `,
      values: [table.tableName, schemaName]
    });

  return rows;
};

export const definitionForTableInSchema = async (
  table: TableMeta,
  schemaName: string,
  enums: EnumData,
  customTypes: CustomTypes,  // an 'out' parameter
  config: CompleteConfig,
  pool: pg.Pool,
) => {
  let rows;
  if (table.tableType === 'materialized view') {
    rows = await columnsForMaterializedView(
      table,
      schemaName,
      pool
    );
  } else {
    rows = await columnsForTable(
      table,
      schemaName,
      pool
    );
  }

  const
    selectables: string[] = [],
    whereables: string[] = [],
    insertables: string[] = [],
    updatables: string[] = [];

  const tableName = table.tableName;

  rows.forEach(row => {
    const { column, isGenerated, isNullable, hasDefault, udtName, domainName } = row;
    let type = tsTypeForPgType(udtName, enums);

    const
      columnOptions =
        (config.columnOptions[tableName] && config.columnOptions[tableName][column]) ??
        (config.columnOptions["*"] && config.columnOptions["*"][column]),
      isInsertable = !isGenerated && columnOptions?.insert !== 'excluded',
      isUpdatable = !isGenerated && columnOptions?.update !== 'excluded',
      insertablyOptional = isNullable || hasDefault || columnOptions?.insert === 'optional' ? '?' : '',
      orNull = isNullable ? ' | null' : '',
      orDateString = type === 'Date' ? ' | db.DateString' : type === 'Date[]' ? ' | db.DateString[]' : '',
      orDefault = isNullable || hasDefault ? ' | db.DefaultType' : '';

    // Now, 4 cases: 
    //   1. null domain, known udt        <-- standard case
    //   2. null domain, unknown udt      <-- custom type:       create type file, with placeholder 'any'
    //   3. non-null domain, known udt    <-- alias type:        create type file, with udt-based placeholder
    //   4. non-null domain, unknown udt  <-- alias custom type: create type file, with placeholder 'any'

    // Note: arrays of domains or custom types are treated as their own custom types

    if (type === 'any' || domainName !== null) {  // cases 2, 3, 4
      const
        customType: string = domainName ?? udtName,
        prefixedCustomType = transformCustomType(customType, config);

      customTypes[prefixedCustomType] = type;
      type = 'c.' + prefixedCustomType;
    }

    selectables.push(`${column}: ${type}${orNull};`);

    const basicWhereableTypes = `${type} | db.Parameter<${type}>${orDateString} | db.SQLFragment | db.ParentColumn`;
    whereables.push(`${column}?: ${basicWhereableTypes} | db.SQLFragment<any, ${basicWhereableTypes}>;`);

    const basicInsertableTypes = `${type} | db.Parameter<${type}>${orDateString}${orNull}${orDefault} | db.SQLFragment`;
    if (isInsertable) insertables.push(`${column}${insertablyOptional}: ${basicInsertableTypes};`);
    if (isUpdatable) updatables.push(`${column}?: ${basicInsertableTypes} | db.SQLFragment<any, ${basicInsertableTypes}>;`);
  });

  const
    result = await pool.query({
      text: `
        SELECT i."indexname"
        FROM "pg_indexes" i 
        JOIN "pg_class" c ON c."relname" = i."indexname" 
        JOIN "pg_index" idx ON idx."indexrelid" = c."oid" AND idx."indisunique" 
        WHERE i."tablename" = $1`,
      values: [tableName]
    }),
    uniqueIndexes = result.rows;

  const tableDef = `
export namespace ${tableName} {
  export type Table = '${tableName}';
  export interface Selectable {
    ${selectables.join('\n    ')}
  }
  export interface Whereable {
    ${whereables.join('\n    ')}
  }
  export interface Insertable {
    ${insertables.join('\n    ')}
  }
  export interface Updatable {
    ${updatables.join('\n    ')}
  }
  export interface JSONSelectable extends JSONSelectableFromSelectable<Selectable> { }
  export type UniqueIndex = ${uniqueIndexes.length > 0 ?
      uniqueIndexes.map(ui => "'" + ui.indexname + "'").join(' | ') :
      'never'};
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = db.GenericSQLExpression | db.ColumnNames<Updatable | (keyof Updatable)[]> | db.ColumnValues<Updatable> | Table | Whereable | Column;
  export type SQL = SQLExpression | SQLExpression[];
}`;
  return tableDef;
};

const transformCustomType = (customType: string, config: CompleteConfig) => {
  const
    ctt = config.customTypesTransform,
    underscoredType = customType.replace(/\W+/g, '_'),
    legalisedType = customType.replace(/\W+/g, '');

  return ctt === 'my_type' ? legalisedType :
    ctt === 'PgMyType' ? ('Pg_' + legalisedType).replace(/_[^_]/g, m => m.charAt(1).toUpperCase()) :
      ctt === 'PgMy_type' ? 'Pg' + underscoredType.charAt(0).toUpperCase() + underscoredType.slice(1) :
        ctt(customType);
};

const mappedUnion = (arr: string[], fn: (name: string) => string) =>
  arr.length === 0 ? 'any' : arr.map(name => fn(name)).join(' | ');

export const crossTableTypesForTables = (tableNames: string[]) => `${tableNames.length === 0 ?
  '\n// `never` rather than `any` types would be more accurate in this no-tables case, but they stop `shortcuts.ts` compiling\n' : ''
  }
export type Table = ${mappedUnion(tableNames, name => `${name}.Table`)};
export type Selectable = ${mappedUnion(tableNames, name => `${name}.Selectable`)};
export type Whereable = ${mappedUnion(tableNames, name => `${name}.Whereable`)};
export type Insertable = ${mappedUnion(tableNames, name => `${name}.Insertable`)};
export type Updatable = ${mappedUnion(tableNames, name => `${name}.Updatable`)};
export type UniqueIndex = ${mappedUnion(tableNames, name => `${name}.UniqueIndex`)};
export type Column = ${mappedUnion(tableNames, name => `${name}.Column`)};
export type AllTables = [${tableNames.map(name => `${name}.Table`).join(', ')}];

${['Selectable', 'Whereable', 'Insertable', 'Updatable', 'UniqueIndex', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = ${tableNames.length === 0 ? 'any' : `{${tableNames.map(name => `
  ${name}: ${name}.${thingable};`).join('')}
}[T]`};
`).join('')}`;
