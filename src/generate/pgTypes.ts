/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type { EnumData } from './enums';


const baseTsTypeForBasePgType = (pgType: string, enums: EnumData) => {
  const hasOwnProp = Object.prototype.hasOwnProperty;
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
    case 'int8':
      return 'string';
    case 'int2':
    case 'int4':
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
      return 'db.JSONValue';
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return 'Date';
    default:
      if (hasOwnProp.call(enums, pgType)) return pgType;
      return null;
  }
};

export const tsTypeForPgType = (pgType: string, enums: EnumData) => {
  // basic and enum types (enum names can begin with an underscore even if not an array)
  const baseTsType = baseTsTypeForBasePgType(pgType, enums);
  if (baseTsType !== null) return baseTsType;

  // arrays of basic and enum types: pg prefixes these with underscore (_)
  // see https://www.postgresql.org/docs/current/sql-createtype.html#id-1.9.3.94.5.9
  if (pgType.charAt(0) === '_') {
    const arrayTsType = baseTsTypeForBasePgType(pgType.slice(1), enums);
    if (arrayTsType !== null) return arrayTsType + '[]';
  }

  return 'any';
};