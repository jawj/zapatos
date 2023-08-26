/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/

export * from './canary';
export * from './config';
export * from './core';
export * from './date';
export * from './pgErrors';
export { registerDeserializeHook, registerSerdeHook, registerSerdeHooksForTable, registerSerializeHook, type SerdeHook } from './serde';
export * from './shortcuts';
export * from './transaction';
export { mapWithSeparator } from './utils';

import { types } from 'pg';

const JSONBigNative = require('json-bigint')({ useNativeBigInt: true });
types.setTypeParser(types.builtins.JSONB, JSONBigNative.parse);
export * as conditions from './conditions';