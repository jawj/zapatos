/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as db from '../src';
import type * as s from '../schema';


export type EnumData = { [k: string]: string[] };

export const enumDataForSchema = async (schemaName: string, pool: db.Queryable) => {
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

export const enumTypesForEnumData = (enums: EnumData) => {
  const types = Object.keys(enums)
    .map(name => `
export type ${name} = ${enums[name].map(v => `'${v}'`).join(' | ')};
export namespace every {
  export type ${name} = [${enums[name].map(v => `'${v}'`).join(', ')}];
}`)
    .join('');

  return types;
};