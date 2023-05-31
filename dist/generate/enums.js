"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.enumTypesForEnumData = exports.enumDataForSchema = void 0;
const enumDataForSchema = async (schemaName, queryFn) => {
    const { rows } = await queryFn({
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
        values: [schemaName],
    }), enums = rows.reduce((memo, row) => {
        var _a;
        memo[row.name] = (_a = memo[row.name]) !== null && _a !== void 0 ? _a : [];
        memo[row.name].push(row.value);
        return memo;
    }, {});
    return enums;
};
exports.enumDataForSchema = enumDataForSchema;
const enumTypesForEnumData = (enums) => {
    const types = Object.keys(enums)
        .map(name => `
export type ${name} = ${enums[name].map(v => `'${v}'`).join(' | ')};
export namespace every {
  export type ${name} = [${enums[name].map(v => `'${v}'`).join(', ')}];
}`)
        .join('');
    return types;
};
exports.enumTypesForEnumData = enumTypesForEnumData;
