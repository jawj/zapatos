#!/usr/bin/env ts-node

import * as pg from 'pg';
import * as fs from 'fs';
import * as db from './src';
import * as s from './schema'

type EnumData = { [k: string]: string[] };

const enumDataForSchema = async (schemaName: string, pool: db.Queryable) => {
  const
    rows = await db.sql<s.pg_type.SQL | s.pg_enum.SQL | s.pg_namespace.SQL>`
      SELECT n.${"nspname"} AS "schema", t.${"typname"} AS "name", e.${"enumlabel"} AS value
      FROM ${"pg_type"} t
      JOIN ${"pg_enum"} e ON t.${"oid"} = e.${"enumtypid"}
      JOIN ${"pg_namespace"} n ON n.${"oid"} = t.${"typnamespace"}
      WHERE n.${"nspname"} = ${db.param(schemaName)}
      ORDER BY t.${"typname"} ASC, e.${"enumlabel"} ASC`.run(pool),
    
    enums: EnumData = rows.reduce((memo, row) => {
      memo[row.name] = memo[row.name] ?? [];
      memo[row.name].push(row.value);
      return memo;
    }, {});
  
  return enums;
}

const enumTypesForEnumData = (enums: EnumData) => {
  const types = Object.keys(enums)
    .map(name => `
export type ${name} = ${enums[name].map(v => `'${v}'`).join(' | ')};
export namespace every {
  export type ${name} = [${enums[name].map(v => `'${v}'`).join(', ')}];
}`)
    .join('');

  return types;
}

const tsTypeForPgType = (pgType: string, enums: EnumData) => {
  switch (pgType) {
    case 'bpchar':
    case 'char':
    case 'varchar':
    case 'text':
    case 'citext':
    case 'uuid':
    case 'bytea':
    case 'inet':
    case 'time':
    case 'timetz':
    case 'interval':
    case 'name':
      return 'string';
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
    case 'money':
    case 'oid':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'json':
    case 'jsonb':
      return 'JSONValue';
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return 'Date';
    case '_int2':
    case '_int4':
    case '_int8':
    case '_float4':
    case '_float8':
    case '_numeric':
    case '_money':
      return 'number[]';
    case '_bool':
      return 'boolean[]';
    case '_varchar':
    case '_text':
    case '_citext':
    case '_uuid':
    case '_bytea':
      return 'string[]';
    case '_json':
    case '_jsonb':
      return 'JSONArray';
    case '_timestamptz':
      return 'Date[]';
    default:
      if (enums.hasOwnProperty(pgType)) return pgType;

      console.log(`Type ${pgType} was mapped to any`);
      return 'any';
  }
}

const tablesInSchema = async (schemaName: string, pool: db.Queryable): Promise<string[]> => {
  const rows = await db.sql<s.information_schema.columns.SQL>`
    SELECT ${"table_name"} FROM ${'"information_schema"."columns"'} 
    WHERE ${{ table_schema: schemaName }} 
    GROUP BY ${"table_name"} ORDER BY lower(${"table_name"})`.run(pool);

  return rows.map(r => r.table_name);
}

const definitionForTableInSchema = async (tableName: string, schemaName: string, enums: EnumData, pool: db.Queryable) => {
  const
    rows = await db.sql<s.information_schema.columns.SQL>`
      SELECT
        ${"column_name"} AS "column"
      , ${"is_nullable"} = 'YES' AS "nullable"
      , ${"column_default"} IS NOT NULL AS "hasDefault"
      , ${"udt_name"} AS "pgType"
      FROM ${'"information_schema"."columns"'}
      WHERE ${{ table_name: tableName, table_schema: schemaName }}`.run(pool),
    
    selectables: string[] = [],
    insertables: string[] = [];

    rows.forEach(row => {
      const
        { column, nullable, hasDefault } = row,
        type = tsTypeForPgType(row.pgType, enums),
        insertablyOptional = nullable || hasDefault ? '?' : '',
        orNull = nullable ? ' | null' : '',
        orDateString = type === 'Date' ? ' | DateString' : type === 'Date[]' ? ' | DateString[]' : '',
        orDefault = nullable || hasDefault ? ' | DefaultType' : '';

        selectables.push(`${column}: ${type}${orNull};`);
        insertables.push(`${column}${insertablyOptional}: ${type}${orDateString}${orNull}${orDefault} | SQLFragment;`);
      });

  return `
export namespace ${tableName} {
  export type Table = "${tableName}";
  export interface Selectable {
    ${selectables.join('\n    ')}
  };
  export interface Insertable {
    ${insertables.join('\n    ')}
  };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}`;
}

const crossTableTypesForTables = (tableNames: string[]) => `
export type Table = ${tableNames.map(name => `${name}.Table`).join(' | ')};
export type Selectable = ${tableNames.map(name => `${name}.Selectable`).join(' | ')};
export type Whereable = ${tableNames.map(name => `${name}.Whereable`).join(' | ')};
export type Insertable = ${tableNames.map(name => `${name}.Insertable`).join(' | ')};
export type Updatable = ${tableNames.map(name => `${name}.Updatable`).join(' | ')};
export type Column = ${tableNames.map(name => `${name}.Column`).join(' | ')};
export type AllTables = [${tableNames.map(name => `${name}.Table`).join(', ')}];

${['Selectable', 'Whereable', 'Insertable', 'Updatable', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = ${tableNames.map(name => `
  T extends ${name}.Table ? ${name}.${thingable} :`).join('')}
  ${thingable};
`).join('')}
`;

const header = () => `
/* 
 * generated by zapatos: anything you change here is liable to get overwritten
 * generated on ${new Date().toISOString()}
 */

import {
  JSONValue,
  JSONArray,
  DateString,
  SQLFragment,
  SQL,
  GenericSQLExpression,
  ColumnNames,
  ColumnValues,
  ParentColumn,
  DefaultType,
} from "./src/core";

`;

interface SchemaRules {
  [schema: string]: {
    include: '*' | string[];
    exclude: '*' | string[];
  }
}

const tsForDBConfigAndSchemaRules = async (dbConfig: pg.ClientConfig, schemas: SchemaRules = { public: { include: '*', exclude: [] } }) => {
  const
    pool = new pg.Pool(dbConfig),
    ts = header() + (await Promise.all(
    Object.keys(schemas).map(async schema => {
      const
        rules = schemas[schema],
        tables = rules.exclude === '*' ? [] :
          (rules.include === '*' ? await tablesInSchema(schema, pool) : rules.include)
            .filter(table => rules.exclude.indexOf(table) < 0),
        enums = await enumDataForSchema(schema, pool),
        tableDefs = await Promise.all(tables.map(async table => definitionForTableInSchema(table, schema, enums, pool)));

      return `\n/* === schema: ${schema} === */\n` +
        enumTypesForEnumData(enums) +
        tableDefs.join('\n') +
        crossTableTypesForTables(tables);
    }))
  ).join('\n\n');

  pool.end();
  return ts;
}


(async () => {
  const
    [_0, _1, dbConfigJSON, schemaRulesJSON] = process.argv,
    dbConfig = JSON.parse(dbConfigJSON),
    schemaRules = schemaRulesJSON ?
      JSON.parse(schemaRulesJSON) :
      { public: { include: '*', exclude: [] } },
    ts = await tsForDBConfigAndSchemaRules(dbConfig, schemaRules);
  
  fs.mkdirSync('zapatos', { recursive: true });  // i.e. mkdir -p
  fs.symlinkSync(`${__dirname}/src`, 'zapatos/src');
  fs.writeFileSync('zapatos/schema.ts', ts, { flag: 'w' });
})();

// npx zapatos '{ "connectionString": "postgresql://localhost/mostly_ormless" }' '{ "public": { "include": "*", "exclude": ["geography_columns", "geometry_columns", "raster_columns", "raster_overviews", "spatial_ref_sys"] } }'
