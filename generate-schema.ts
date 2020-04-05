#!/usr/bin/env ts-node

import * as pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as db from './src';
import * as s from './schema';

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
};

const enumTypesForEnumData = (enums: EnumData) => {
  const types = Object.keys(enums)
    .map(name => `
export type ${name} = ${enums[name].map(v => `'${v}'`).join(' | ')};
export namespace every {
  export type ${name} = [${enums[name].map(v => `'${v}'`).join(', ')}];
}`)
    .join('');

  return types;
};

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

      console.log(`* Postgres type "${pgType}" was mapped to TypeScript type "any"`);
      return 'any';
  }
};

const tablesInSchema = async (schemaName: string, pool: db.Queryable): Promise<string[]> => {
  const rows = await db.sql<s.information_schema.columns.SQL>`
    SELECT ${"table_name"} FROM ${'"information_schema"."columns"'} 
    WHERE ${{ table_schema: schemaName }} 
    GROUP BY ${"table_name"} ORDER BY lower(${"table_name"})`.run(pool);

  return rows.map(r => r.table_name);
};

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
  }
  export interface Insertable {
    ${insertables.join('\n    ')}
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}`;
};

const crossTableTypesForTables = (tableNames: string[]) => `
export type Table = ${tableNames.map(name => `${name}.Table`).join(' | ')};
export type Selectable = ${tableNames.map(name => `${name}.Selectable`).join(' | ')};
export type Whereable = ${tableNames.map(name => `${name}.Whereable`).join(' | ')};
export type Insertable = ${tableNames.map(name => `${name}.Insertable`).join(' | ')};
export type Updatable = ${tableNames.map(name => `${name}.Updatable`).join(' | ')};
export type Column = ${tableNames.map(name => `${name}.Column`).join(' | ')};
export type AllTables = [${tableNames.map(name => `${name}.Table`).join(', ')}];

${['Selectable', 'Whereable', 'Insertable', 'Updatable', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = {${tableNames.map(name => `
  ${name}: ${name}.${thingable},`).join('')}
}[T];
`).join('')}
`;

const moduleRoot = () =>
  fs.existsSync(path.join(__dirname, 'package.json')) ? __dirname : path.join(__dirname, '..');
    

const header = (config: Config) => {
  const
    pkgPath = path.join(moduleRoot(), 'package.json'),
    pkg = JSON.parse(fs.readFileSync(pkgPath, { encoding: 'utf8' }));
  
  return `
/* 
 * generated by ${pkg.name} (v${pkg.version}): ${pkg.repository.url}
 * generated on ${new Date().toISOString()}
 * 
 * MANUAL CHANGES ARE LIABLE TO GET OVERWRITTEN
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
};

interface SchemaRules {
  [schema: string]: {
    include: '*' | string[];
    exclude: '*' | string[];
  };
}

interface Config {
  db: pg.ClientConfig;
  outDir: string;
  srcMode: 'symlink' | 'copy';
  schemas: SchemaRules;
}

const tsForConfig = async (config: Config) => {
  const
    { schemas, db } = config,
    pool = new pg.Pool(db),
    ts = header(config) +
      (await Promise.all(
        Object.keys(schemas).map(async schema => {
          const
            rules = schemas[schema],
            tables = rules.exclude === '*' ? [] :  // exclude takes precedence
              (rules.include === '*' ? await tablesInSchema(schema, pool) : rules.include)
                .filter(table => rules.exclude.indexOf(table) < 0),
            enums = await enumDataForSchema(schema, pool),
            tableDefs = await Promise.all(tables.map(async table => definitionForTableInSchema(table, schema, enums, pool)));

          return `\n/* === schema: ${schema} === */\n` +
            `\n/* --- enums --- */\n` +
            enumTypesForEnumData(enums) +
            `\n\n/* --- tables --- */\n` +
            tableDefs.join('\n') +
            `\n\n/* --- cross-table types --- */\n` +
            crossTableTypesForTables(tables);
        }))
      ).join('\n\n');

  await pool.end();
  return ts;
};

const recursivelyInterpolateEnvVars = (obj: any): any =>
  typeof obj === 'string' ?
    obj.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, ($0, name) => {
      const e = process.env[name];
      if (e === undefined) throw new Error(`Environment variable '${name}' is not set`);
      return e;
    }) :
    Array.isArray(obj) ?
      obj.map(item => recursivelyInterpolateEnvVars(item)) :
      typeof obj === 'object' ?
        Object.keys(obj).reduce<any>((memo, key) => {
          memo[key] = recursivelyInterpolateEnvVars(obj[key]);
          return memo;
        }, {}) : obj;

const getConfig = () => {
  const
    config: Config = {  // defaults
      db: {},
      outDir: '.',
      srcMode: 'copy',
      schemas: { public: { include: '*', exclude: [] } },
    },
    configFile = 'zapatosconfig.json',
    configJSON = fs.existsSync(configFile) ? fs.readFileSync(configFile, { encoding: 'utf8' }) : '{}',
    argsJSON = process.argv[2] ?? '{}';
  
  try { 
    const fileConfig = JSON.parse(configJSON);
    Object.assign(config, fileConfig);
  } catch (err) {
    throw new Error(`If present, zapatosconfig.ts must be a valid JSON file: ${err.message}`);
  }

  try {
    const argsConfig = JSON.parse(argsJSON);
    Object.assign(config, argsConfig);
  } catch (err) {
    throw new Error(`If present, zapatos arguments must be valid JSON: ${err.message}`);
  }

  if (Object.keys(config.db).length < 1) throw new Error(`Zapatos needs database connection details`);

  const interpolatedConfig = recursivelyInterpolateEnvVars(config);
  return interpolatedConfig;
};

const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

void (async () => {
  const
    config = getConfig(),
    ts = await tsForConfig(config),
    folderName = 'zapatos',
    srcName = 'src',
    schemaName = 'schema.ts',
    root = moduleRoot(),
    folderLocation = path.join(config.outDir, folderName),
    srcLocation = path.join(folderLocation, srcName),
    pathToCode = path.join(root, srcName),
    relativePathToCode = path.relative(folderLocation, pathToCode),
    schemaLocation = path.join(folderLocation, schemaName);

  if (!fs.existsSync(folderLocation)) fs.mkdirSync(folderLocation);
  
  // TODO: deal with the case when we did have mode copy and now have mode symlink or vice versa

  if (config.srcMode === 'symlink') {
    if (fs.existsSync(srcLocation)) fs.unlinkSync(srcLocation);

    console.log(`Creating symlink: ${srcLocation} -> ${relativePathToCode}`);
    fs.symlinkSync(relativePathToCode, srcLocation);
  
  } else {
    const srcFiles = recurseNodes(pathToCode).map(p => path.relative(pathToCode, p));
    for (const f of srcFiles) {
      const
        srcPath = path.join(pathToCode, f),
        targetDirPath = path.join(srcLocation, path.dirname(f)),
        targetPath = path.join(srcLocation, f);
      
      console.log(`Writing file: ${targetPath}`);
      fs.mkdirSync(targetDirPath, { recursive: true });
      fs.copyFileSync(srcPath, targetPath);
    }
  }

  console.log(`Writing generated schema: ${schemaLocation}`);
  fs.writeFileSync(schemaLocation, ts, { flag: 'w' });
})();

