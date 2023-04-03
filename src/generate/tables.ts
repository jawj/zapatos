/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as pg from 'pg';
import { tsTypeForPgType } from './pgTypes';
import type { EnumData } from './enums';
import type { CustomTypes } from './tsOutput';
import { CompleteConfig } from './config';


export interface Relation {
  schema: string;
  name: string;
  type: 'table' | 'view' | 'fdw' | 'mview';
  insertable: boolean;
}

export const relationsInSchema = async (schemaName: string, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>): Promise<Relation[]> => {
  const { rows } = await queryFn({
    text: `
      SELECT $1 as schema
      , table_name AS name
      , lower(table_name) AS lname  -- using a case-insensitive sort, but you can't order by a function in a UNION query
      , CASE table_type WHEN 'VIEW' THEN 'view' WHEN 'FOREIGN' THEN 'fdw' ELSE 'table' END AS type
      , CASE WHEN is_insertable_into = 'YES' THEN true ELSE false END AS insertable
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type != 'LOCAL TEMPORARY'

      UNION ALL

      SELECT $1 as schema
      , matviewname AS name
      , lower(matviewname) AS lname
      , 'mview'::text AS type
      , false AS insertable
      FROM pg_catalog.pg_matviews
      WHERE schemaname = $1

      ORDER BY lname, name
    `,
    values: [schemaName]
  });

  return rows;
};

const columnsForRelation = async (rel: Relation, schemaName: string, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>) => {
  const { rows } = await queryFn({
    text:
      rel.type === 'mview'
        ? `
        SELECT
          a.attname AS "column"
        , a.attnotnull = 'f' AS "isNullable"
        , true AS "isGenerated"  -- true, to reflect that we can't write to materalized views
        , false AS "hasDefault"   -- irrelevant, since we can't write to materalized views
        , NULL as "defaultValue"
        , CASE WHEN t1.typtype = 'd' THEN t2.typname ELSE t1.typname END AS "udtName"
        , CASE WHEN t1.typtype = 'd' THEN t1.typname ELSE NULL END AS "domainName"
        , d.description AS "description"     
        FROM pg_catalog.pg_class c
        LEFT JOIN pg_catalog.pg_attribute a ON c.oid = a.attrelid
        LEFT JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        LEFT JOIN pg_catalog.pg_type t1 ON t1.oid = a.atttypid
        LEFT JOIN pg_catalog.pg_type t2 ON t2.oid = t1.typbasetype
        LEFT JOIN pg_catalog.pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
        WHERE c.relkind = 'm' AND a.attnum >= 1 AND c.relname = $1 AND n.nspname = $2`
        : `
        SELECT
          column_name AS "column"
        , is_nullable = 'YES' AS "isNullable"
        , is_generated = 'ALWAYS' OR identity_generation = 'ALWAYS' AS "isGenerated"
        , column_default IS NOT NULL OR identity_generation = 'BY DEFAULT' AS "hasDefault"
        , column_default::text AS "defaultValue"
        , udt_name AS "udtName"
        , domain_name AS "domainName"
        , d.description AS "description"
        FROM information_schema.columns AS c
        LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname = c.table_schema
        LEFT JOIN pg_catalog.pg_class cl ON cl.relkind = 'r' AND cl.relname = c.table_name AND cl.relnamespace = ns.oid
        LEFT JOIN pg_catalog.pg_description d ON d.objoid = cl.oid AND d.objsubid = c.ordinal_position
        WHERE c.table_name = $1 AND c.table_schema = $2`,
    values: [rel.name, schemaName],
  });

  return rows;
};

function quoteIfIllegalIdentifier(identifier: string) {
  // note: we'll redundantly quote a bunch of non-ASCII characters like this
  return identifier.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/) ? identifier : `"${identifier}"`;
}

export const definitionForRelationInSchema = async (
  rel: Relation,
  schemaName: string,
  enums: EnumData,
  customTypes: CustomTypes,  // an 'out' parameter
  config: CompleteConfig,
  queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>,
) => {
  const
    rows = await columnsForRelation(rel, schemaName, queryFn),
    selectables: string[] = [],
    JSONSelectables: string[] = [],
    whereables: string[] = [],
    insertables: string[] = [],
    updatables: string[] = [];

  rows.forEach(row => {
    const { column, isGenerated, isNullable, hasDefault, udtName, domainName } = row;
    let
      selectableType = tsTypeForPgType(udtName, enums, 'Selectable'),
      JSONSelectableType = tsTypeForPgType(udtName, enums, 'JSONSelectable'),
      whereableType = tsTypeForPgType(udtName, enums, 'Whereable'),
      insertableType = tsTypeForPgType(udtName, enums, 'Insertable'),
      updatableType = tsTypeForPgType(udtName, enums, 'Updatable');

    const
      columnDoc = createColumnDoc(config, schemaName, rel, row),
      schemaPrefix = config.unprefixedSchema === schemaName ? '' : `${schemaName}.`,
      prefixedRelName = schemaPrefix + rel.name,
      columnOptions =
        (config.columnOptions[prefixedRelName] && config.columnOptions[prefixedRelName][column]) ??
        (config.columnOptions["*"] && config.columnOptions["*"][column]),
      isInsertable = rel.insertable && !isGenerated && columnOptions?.insert !== 'excluded',
      isUpdatable = rel.insertable && !isGenerated && columnOptions?.update !== 'excluded',
      insertablyOptional = isNullable || hasDefault || columnOptions?.insert === 'optional' ? '?' : '',
      orNull = isNullable ? ' | null' : '',
      orDefault = isNullable || hasDefault ? ' | db.DefaultType' : '',
      possiblyQuotedColumn = quoteIfIllegalIdentifier(column);

    // Now, 4 cases:
    //   1. null domain, known udt        <-- standard case
    //   2. null domain, unknown udt      <-- custom type:       create type file, with placeholder 'any'
    //   3. non-null domain, known udt    <-- alias type:        create type file, with udt-based placeholder
    //   4. non-null domain, unknown udt  <-- alias custom type: create type file, with placeholder 'any'

    // Note: arrays of domains or custom types are treated as their own custom types

    if (selectableType === 'any' || domainName !== null) {  // cases 2, 3, 4
      const
        customType: string = domainName ?? udtName,
        prefixedCustomType = transformCustomType(customType, config);

      customTypes[prefixedCustomType] = selectableType;
      selectableType = JSONSelectableType = whereableType = insertableType = updatableType =
        'c.' + prefixedCustomType;
    }

    selectables.push(`${columnDoc}${possiblyQuotedColumn}: ${selectableType}${orNull};`);
    JSONSelectables.push(`${columnDoc}${possiblyQuotedColumn}: ${JSONSelectableType}${orNull};`);

    const basicWhereableTypes = `${whereableType} | db.Parameter<${whereableType}> | db.SQLFragment | db.ParentColumn`;
    whereables.push(`${columnDoc}${possiblyQuotedColumn}?: ${basicWhereableTypes} | db.SQLFragment<any, ${basicWhereableTypes}>;`);

    const insertableTypes = `${insertableType} | db.Parameter<${insertableType}>${orNull}${orDefault} | db.SQLFragment`;
    if (isInsertable) insertables.push(`${columnDoc}${possiblyQuotedColumn}${insertablyOptional}: ${insertableTypes};`);

    const updatableTypes = `${updatableType} | db.Parameter<${updatableType}>${orNull}${orDefault} | db.SQLFragment`;
    if (isUpdatable) updatables.push(`${columnDoc}${possiblyQuotedColumn}?: ${updatableTypes} | db.SQLFragment<any, ${updatableTypes}>;`);
  });

  const
    result = await queryFn({
      text: `
        SELECT DISTINCT i.indexname
        FROM pg_catalog.pg_indexes i
        JOIN pg_catalog.pg_class c ON c.relname = i.indexname
        JOIN pg_catalog.pg_index idx ON idx.indexrelid = c.oid AND idx.indisunique
        WHERE i.tablename = $1 AND i.schemaname = $2
        ORDER BY i.indexname`,
      values: [rel.name, schemaName]
    }),
    uniqueIndexes = result.rows;

  const
    schemaPrefix = schemaName === config.unprefixedSchema ? '' : `${schemaName}.`,
    friendlyRelTypes: Record<Relation['type'], string> = {
      table: 'Table',
      fdw: 'Foreign table',
      view: 'View',
      mview: 'Materialized view',
    },
    friendlyRelType = friendlyRelTypes[rel.type],
    tableComment = config.schemaJSDoc ? `
/**
 * **${schemaPrefix}${rel.name}**
 * - ${friendlyRelType} in database
 */` : ``,
    tableDef = `${tableComment}
export namespace ${rel.name} {
  export type Table = '${schemaPrefix}${rel.name}';
  export interface Selectable {
    ${selectables.join('\n    ')}
  }
  export interface JSONSelectable {
    ${JSONSelectables.join('\n    ')}
  }
  export interface Whereable {
    ${whereables.join('\n    ')}
  }
  export interface Insertable {
    ${insertables.length > 0 ? insertables.join('\n    ') : `[key: string]: never;`}
  }
  export interface Updatable {
    ${updatables.length > 0 ? updatables.join('\n    ') : `[key: string]: never;`}
  }
  export type UniqueIndex = ${uniqueIndexes.length > 0 ?
        uniqueIndexes.map(ui => "'" + ui.indexname + "'").join(' | ') :
        'never'};
  export type Column = keyof Selectable;
  export type FQColumn = \`\${Table}.\${keyof Selectable}\`; 
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = db.GenericSQLExpression | db.ColumnNames<Updatable | (keyof Updatable)[], Table> | db.ColumnValues<Updatable> | Table | Whereable | Column | db.ParentColumn | db.GenericSQLExpression | FQColumn;
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

const
  tableMappedUnion = (arr: Relation[], suffix: string) =>
    arr.length === 0 ? 'never' : arr.map(rel => `${rel.name}.${suffix}`).join(' | '),
  tableMappedArray = (arr: Relation[], suffix: string) =>
    '[' + arr.map(rel => `${rel.name}.${suffix}`).join(', ') + ']';

export const crossTableTypesForTables = (tables: Relation[]) => `${tables.length === 0 ?
  '\n// `never` rather than `any` types would be more accurate in this no-tables case, but they stop `shortcuts.ts` compiling\n' : ''
  }
export type Table = ${tableMappedUnion(tables, 'Table')};
export type Selectable = ${tableMappedUnion(tables, 'Selectable')};
export type JSONSelectable = ${tableMappedUnion(tables, 'JSONSelectable')};
export type Whereable = ${tableMappedUnion(tables, 'Whereable')};
export type Insertable = ${tableMappedUnion(tables, 'Insertable')};
export type Updatable = ${tableMappedUnion(tables, 'Updatable')};
export type UniqueIndex = ${tableMappedUnion(tables, 'UniqueIndex')};
export type Column = ${tableMappedUnion(tables, 'Column')};

export type AllBaseTables = ${tableMappedArray(tables.filter(rel => rel.type === 'table'), 'Table')};
export type AllForeignTables = ${tableMappedArray(tables.filter(rel => rel.type === 'fdw'), 'Table')};
export type AllViews = ${tableMappedArray(tables.filter(rel => rel.type === 'view'), 'Table')};
export type AllMaterializedViews = ${tableMappedArray(tables.filter(rel => rel.type === 'mview'), 'Table')};
export type AllTablesAndViews = ${tableMappedArray(tables, 'Table')};`;

export const crossSchemaTypesForAllTables = (allTables: Relation[], unprefixedSchema: string | null) =>
  ['Selectable', 'JSONSelectable', 'Whereable', 'Insertable', 'Updatable', 'UniqueIndex', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = ${allTables.length === 0 ? 'any' : `{${allTables.map(rel => `
  "${rel.schema === unprefixedSchema ? '' : `${rel.schema}.`}${rel.name}": ${rel.schema === unprefixedSchema ? '' : `${rel.schema}.`}${rel.name}.${thingable};`).join('')}
}[T]`};
`).join('');

const
  schemaMappedUnion = (arr: string[], suffix: string) =>
    arr.length === 0 ? 'any' : arr.map(s => `${s}.${suffix}`).join(' | '),
  schemaMappedArray = (arr: string[], suffix: string) =>
    '[' + arr.map(s => `...${s}.${suffix}`).join(', ') + ']';

export const crossSchemaTypesForSchemas = (schemas: string[]) => `
export type Schema = ${schemas.map(s => `'${s}'`).join(' | ')};
export type Table = ${schemaMappedUnion(schemas, 'Table')};
export type Selectable = ${schemaMappedUnion(schemas, 'Selectable')};
export type JSONSelectable = ${schemaMappedUnion(schemas, 'JSONSelectable')};
export type Whereable = ${schemaMappedUnion(schemas, 'Whereable')};
export type Insertable = ${schemaMappedUnion(schemas, 'Insertable')};
export type Updatable = ${schemaMappedUnion(schemas, 'Updatable')};
export type UniqueIndex = ${schemaMappedUnion(schemas, 'UniqueIndex')};
export type Column = ${schemaMappedUnion(schemas, 'Column')};

export type AllSchemas = [${schemas.map(s => `'${s}'`).join(', ')}];
export type AllBaseTables = ${schemaMappedArray(schemas, 'AllBaseTables')};
export type AllForeignTables = ${schemaMappedArray(schemas, 'AllForeignTables')};
export type AllViews = ${schemaMappedArray(schemas, 'AllViews')};
export type AllMaterializedViews = ${schemaMappedArray(schemas, 'AllMaterializedViews')};
export type AllTablesAndViews = ${schemaMappedArray(schemas, 'AllTablesAndViews')};
`;

const createColumnDoc = (config: CompleteConfig, schemaName: string, rel: Relation, columnDetails: Record<string, unknown>) => {
  if (!config.schemaJSDoc) return '';

  const
    schemaPrefix = schemaName === config.unprefixedSchema ? '' : `${schemaName}.`,
    { column,
      isGenerated,
      isNullable,
      hasDefault,
      defaultValue,
      udtName,
      domainName,
      description,
    } = columnDetails,
    doc = `/**
    * **${schemaPrefix}${rel.name}.${column}**${description ? '\n    *\n    * ' + description : ''}
    * - ${domainName ? `\`${domainName}\` (base type: \`${udtName ?? '(none)'}\`)` : `\`${udtName ?? '(none)'}\``} in database
    * - ${rel.type === 'mview' ? 'Materialized view column' : isGenerated ? 'Generated column' :
        `${isNullable ? 'Nullable' : '`NOT NULL`'}, ${hasDefault && defaultValue === null ? `identity column` : hasDefault ? `default: \`${defaultValue}\`` : `no default`}`}
    */
    `;
  return doc;
};
