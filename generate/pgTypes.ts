/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type { EnumData } from './enums';

export const tsTypeForPgType = (pgType: string, enums: EnumData) => {
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
      if (Object.prototype.hasOwnProperty.call(enums, pgType)) return pgType;

      console.log(`* Postgres type "${pgType}" was mapped to TypeScript type "any"`);
      return 'any';
  }
};