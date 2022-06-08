/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as pg from 'pg';

import type { TsNameTransforms } from '../db';


export type EnumData = { [k: string]: string[] };

export const enumDataForSchema = async (schemaName: string, transforms: TsNameTransforms, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>) => {
  const
    result = await queryFn({
      text: `
        SELECT
          n.nspname AS schema
        , t.typname AS name
        , e.enumlabel AS value
        FROM pg_catalog.pg_type t
        JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = $1
        ORDER BY t.typname ASC, e.enumlabel ASC`,
      values: [transforms.fromTsToPg(schemaName)],
    }),
    rows = result.rows.map(row => ({
      ...row,
      schema: transforms.fromPgToTs(row.schema),
      name: transforms.fromPgToTs(row.name)
    })),
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
