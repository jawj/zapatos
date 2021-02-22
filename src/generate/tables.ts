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

export interface Relation {
  name: string;
  type: 'table' | 'mview';
}

export const relationsInSchema = async (schemaName: string, pool: pg.Pool): Promise<Relation[]> => {
  const { rows } = await pool.query({
    text: `
      SELECT 
        "table_name" AS "name"
      , lower("table_name") AS "lname"  -- because you can't order by a function in a UNION query
      , 'table'::text AS "type"
      FROM "information_schema"."columns"
      WHERE "table_schema" = $1 
      GROUP BY "name"
      UNION ALL
      SELECT
        pg_class.relname AS "name"
      , lower(pg_class.relname) AS "lname"
      , 'mview'::text AS "type"
      FROM pg_catalog.pg_class
      INNER JOIN pg_catalog.pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      WHERE pg_class.relkind = 'm' AND pg_namespace.nspname = $1
      GROUP BY "name"
      ORDER BY "lname", "name"`,
    values: [schemaName]
  });

  return rows;
};

const columnsForRelation = async (rel: Relation, schemaName: string, pool: pg.Pool) => {
  const { rows } = await pool.query({
    text:
      rel.type === "table"
        ? `
        SELECT
          "column_name" AS "column"
        , "is_nullable" = 'YES' AS "isNullable"
        , "is_generated" = 'ALWAYS' OR "identity_generation" = 'ALWAYS' AS "isGenerated"
        , "column_default" IS NOT NULL OR "identity_generation" = 'BY DEFAULT' AS "hasDefault"
        , "column_default"::text AS "defaultValue"
        , "udt_name" AS "udtName"
        , "domain_name" AS "domainName"
        , ( SELECT description 
            FROM pg_description AS d 
            WHERE objoid = $3::regclass AND d.objsubid = c.ordinal_position
          ) AS "description"
        FROM "information_schema"."columns" AS c
        WHERE "table_name" = $1 AND "table_schema" = $2`
        : `
        SELECT
          a.attname AS "column"
        , a.attnotnull = 'f' AS "isNullable"
        , 't' AS "isGenerated"  -- true, to reflect that we can't write to materalized views
        , 'f' AS "hasDefault"   -- irrelevant, since we can't write to materalized views
        , NULL as "defaultValue"
        , CASE WHEN t1.typtype = 'd' THEN t2.typname ELSE t1.typname END AS "udtName"
        , CASE WHEN t1.typtype = 'd' THEN t1.typname ELSE NULL END AS "domainName"
        , ( SELECT description 
            FROM pg_description AS d 
            WHERE objoid = $3::regclass AND d.objsubid = a.attnum
          ) AS "description"        
        FROM pg_catalog.pg_class c
        INNER JOIN pg_catalog.pg_attribute a ON c.oid = a.attrelid
        INNER JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        INNER JOIN pg_catalog.pg_type t1 ON t1.oid = a.atttypid
        LEFT JOIN pg_catalog.pg_type t2 ON t2.oid = t1.typbasetype
        WHERE c.relkind = 'm' AND a.attnum >= 1 AND c.relname = $1 AND n.nspname = $2`,
    values: [rel.name, schemaName, `"${schemaName}"."${rel.name}"`],
  });

  return rows;
};

export const definitionForRelationInSchema = async (
  rel: Relation,
  schemaName: string,
  enums: EnumData,
  customTypes: CustomTypes,  // an 'out' parameter
  config: CompleteConfig,
  pool: pg.Pool,
) => {
  const
    rows = await columnsForRelation(rel, schemaName, pool),
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
      columnDoc = createColumnDoc(schemaName, rel, row),
      columnOptions =
        (config.columnOptions[rel.name] && config.columnOptions[rel.name][column]) ??
        (config.columnOptions["*"] && config.columnOptions["*"][column]),
      isInsertable = !isGenerated && columnOptions?.insert !== 'excluded',
      isUpdatable = !isGenerated && columnOptions?.update !== 'excluded',
      insertablyOptional = isNullable || hasDefault || columnOptions?.insert === 'optional' ? '?' : '',
      orNull = isNullable ? ' | null' : '',
      orDefault = isNullable || hasDefault ? ' | db.DefaultType' : '';

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

    selectables.push(`${columnDoc}${column}: ${selectableType}${orNull};`);
    JSONSelectables.push(`${columnDoc}${column}: ${JSONSelectableType}${orNull};`);

    const basicWhereableTypes = `${whereableType} | db.Parameter<${whereableType}> | db.SQLFragment | db.ParentColumn`;
    whereables.push(`${columnDoc}${column}?: ${basicWhereableTypes} | db.SQLFragment<any, ${basicWhereableTypes}>;`);

    const insertableTypes = `${insertableType} | db.Parameter<${insertableType}>${orNull}${orDefault} | db.SQLFragment`;
    if (isInsertable) insertables.push(`${columnDoc}${column}${insertablyOptional}: ${insertableTypes};`);

    const updatableTypes = `${updatableType} | db.Parameter<${updatableType}>${orNull}${orDefault} | db.SQLFragment`;
    if (isUpdatable) updatables.push(`${columnDoc}${column}?: ${updatableTypes} | db.SQLFragment<any, ${updatableTypes}>;`);
  });

  const
    result = await pool.query({
      text: `
        SELECT i."indexname"
        FROM "pg_indexes" i 
        JOIN "pg_class" c ON c."relname" = i."indexname" 
        JOIN "pg_index" idx ON idx."indexrelid" = c."oid" AND idx."indisunique" 
        WHERE i."tablename" = $1`,
      values: [rel.name]
    }),
    uniqueIndexes = result.rows;

  const tableDef = `
export namespace ${rel.name} {
  export type Table = '${rel.name}';
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
    ${insertables.join('\n    ')}
  }
  export interface Updatable {
    ${updatables.join('\n    ')}
  }
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

const mappedUnion = (arr: Relation[], fn: (name: string) => string) =>
  arr.length === 0 ? 'any' : arr.map(rel => fn(rel.name)).join(' | ');

export const crossTableTypesForTables = (relations: Relation[]) => `${relations.length === 0 ?
  '\n// `never` rather than `any` types would be more accurate in this no-tables case, but they stop `shortcuts.ts` compiling\n' : ''
  }
export type Table = ${mappedUnion(relations, name => `${name}.Table`)};
export type Selectable = ${mappedUnion(relations, name => `${name}.Selectable`)};
export type JSONSelectable = ${mappedUnion(relations, name => `${name}.JSONSelectable`)};
export type Whereable = ${mappedUnion(relations, name => `${name}.Whereable`)};
export type Insertable = ${mappedUnion(relations, name => `${name}.Insertable`)};
export type Updatable = ${mappedUnion(relations, name => `${name}.Updatable`)};
export type UniqueIndex = ${mappedUnion(relations, name => `${name}.UniqueIndex`)};
export type Column = ${mappedUnion(relations, name => `${name}.Column`)};
export type AllTables = [${relations.filter(rel => rel.type === 'table').map(rel => `${rel.name}.Table`).join(', ')}];
export type AllMaterializedViews = [${relations.filter(rel => rel.type === 'mview').map(rel => `${rel.name}.Table`).join(', ')}];

${['Selectable', 'JSONSelectable', 'Whereable', 'Insertable', 'Updatable', 'UniqueIndex', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = ${relations.length === 0 ? 'any' : `{${relations.map(rel => `
  ${rel.name}: ${rel.name}.${thingable};`).join('')}
}[T]`};
`).join('')}`;


const createColumnDoc = (schemaName: string, rel: Relation, columnDetails: Record<string, unknown>) => {
  const {
    column,
    isGenerated,
    isNullable,
    hasDefault,
    defaultValue,
    udtName,
    domainName,
    description,
  } = columnDetails;

  const doc = `/**
    * **${rel.name}.${column}**${description ? '\n    *\n    * ' + description : ''}
    * - ${domainName ? `\`${domainName}\` (base type: \`${udtName ?? '(none)'}\`)` : `\`${udtName ?? '(none)'}\``} in database
    * - ${rel.type === 'mview' ? 'Materialized view column' : isGenerated ? 'Generated column' :
      `${isNullable ? 'Nullable' : '`NOT NULL`'}, ${hasDefault && defaultValue === null ? `identity column` : hasDefault ? `default: \`${defaultValue}\`` : `no default`}`}
    */
    `;
  return doc;
};
