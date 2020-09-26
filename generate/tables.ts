/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as db from '../src';
import type * as s from '../schema';
import { tsTypeForPgType } from './pgTypes';
import type { EnumData } from './enums';
import type { CustomTypes } from './tsOutput';

export const tablesInSchema = async (schemaName: string, pool: db.Queryable): Promise<string[]> => {
  const rows = await db.sql<s.information_schema.columns.SQL>`
    SELECT ${"table_name"} FROM ${'"information_schema"."columns"'} 
    WHERE ${{ table_schema: schemaName }} 
    GROUP BY ${"table_name"} ORDER BY lower(${"table_name"})`.run(pool);

  return rows.map(r => r.table_name);
};

export const definitionForTableInSchema = async (
  tableName: string,
  schemaName: string,
  enums: EnumData,
  customTypes: CustomTypes,  // an 'out' parameter
  pool: db.Queryable,
) => {

  const
    rows = await db.sql<s.information_schema.columns.SQL>`
      SELECT
        ${"column_name"} AS "column"
      , ${"is_nullable"} = 'YES' AS "nullable"
      , ${"is_generated"} = 'ALWAYS' AS "generated"
      , ${"column_default"} IS NOT NULL OR ${"is_identity"} = 'YES' AS "hasDefault"
      , ${"udt_name"} AS "udtName"
      , ${"domain_name"} AS "domainName"
      FROM ${'"information_schema"."columns"'}
      WHERE ${{ table_name: tableName, table_schema: schemaName }}`.run(pool),

    selectables: string[] = [],
    insertables: string[] = [];

  rows.forEach(row => {
    const { column, nullable, hasDefault, udtName, domainName } = row;
    let type = tsTypeForPgType(udtName, enums);

    const
      insertablyOptional = nullable || hasDefault ? '?' : '',
      orNull = nullable ? ' | null' : '',
      orDateString = type === 'Date' ? ' | DateString' : type === 'Date[]' ? ' | DateString[]' : '',
      orDefault = nullable || hasDefault ? ' | DefaultType' : '';

    // TODO: remove `is_generated` columns from Insertable (and Updatable, but not Selectable or Whereable)

    // Now, 4 cases: 
    //   1. null domain, known udt        <-- standard case
    //   2. null domain, unknown udt      <-- custom type:       create type file, with placeholder 'any'
    //   3. non-null domain, known udt    <-- alias type:        create type file, with udt-based placeholder
    //   4. non-null domain, unknown udt  <-- alias custom type: create type file, with placeholder 'any'

    // Note: arrays of domains or custom types are treated as their own custom types

    if (type === 'any' || domainName !== null) {  // cases 2, 3, 4
      const
        customType = domainName ?? udtName,
        legalCustomType = customType.replace(/\W+/g, '_'),
        prefixedCustomType = 'Pg' +
          legalCustomType.charAt(0).toUpperCase() +
          legalCustomType.slice(1);

      customTypes[prefixedCustomType] = type;
      type = 'c.' + prefixedCustomType;
    }

    selectables.push(`${column}: ${type}${orNull};`);
    insertables.push(`${column}${insertablyOptional}: ${type} | Parameter<${type}>${orDateString}${orNull}${orDefault} | SQLFragment;`);
  });

  const uniqueIndexes = await db.sql<s.pg_indexes.SQL | s.pg_class.SQL | s.pg_index.SQL, { indexname: string }[]>`
    SELECT i.${"indexname"}
    FROM ${"pg_indexes"} i 
    JOIN ${"pg_class"} c ON c.${"relname"} = i.${"indexname"} 
    JOIN ${"pg_index"} idx ON idx.${"indexrelid"} = c.${"oid"} AND idx.${"indisunique"} 
    WHERE i.${"tablename"} = ${db.param(tableName)}`.run(pool);

  const tableDef = `
export declare namespace ${tableName} {
  export type Table = '${tableName}';
  export interface Selectable {
    ${selectables.join('\n    ')}
  }
  export interface Insertable {
    ${insertables.join('\n    ')}
  }
  export interface Updatable extends Partial<Insertable> { }
  export interface Whereable extends WhereableFromInsertable<Insertable> { }
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = ${uniqueIndexes.length > 0 ?
      uniqueIndexes.map(ui => "'" + ui.indexname + "'").join(' | ') :
      'never'};
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}`;
  return tableDef;
};

export const crossTableTypesForTables = (tableNames: string[]) => `
export type Table = ${tableNames.map(name => `${name}.Table`).join(' | ')};
export type Selectable = ${tableNames.map(name => `${name}.Selectable`).join(' | ')};
export type Whereable = ${tableNames.map(name => `${name}.Whereable`).join(' | ')};
export type Insertable = ${tableNames.map(name => `${name}.Insertable`).join(' | ')};
export type Updatable = ${tableNames.map(name => `${name}.Updatable`).join(' | ')};
export type UniqueIndex = ${tableNames.map(name => `${name}.UniqueIndex`).join(' | ')};
export type Column = ${tableNames.map(name => `${name}.Column`).join(' | ')};
export type AllTables = [${tableNames.map(name => `${name}.Table`).join(', ')}];

${['Selectable', 'Whereable', 'Insertable', 'Updatable', 'UniqueIndex', 'Column', 'SQL'].map(thingable => `
export type ${thingable}ForTable<T extends Table> = {${tableNames.map(name => `
  ${name}: ${name}.${thingable};`).join('')}
}[T];
`).join('')}
`;

