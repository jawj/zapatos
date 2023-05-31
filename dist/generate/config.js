"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.finaliseConfig = exports.moduleRoot = void 0;
const fs = require("fs");
const path = require("path");
const defaultConfig = {
    outDir: '.',
    outExt: '.d.ts',
    schemas: { public: { include: '*', exclude: [] } },
    debugListener: false,
    progressListener: false,
    warningListener: true,
    customTypesTransform: 'PgMy_type',
    columnOptions: {},
    schemaJSDoc: true,
    unprefixedSchema: 'public',
};
const moduleRoot = () => {
    // __dirname could be either ./generate (ts) or ./dist/generate (js)
    const parentDir = path.join(__dirname, '..');
    return fs.existsSync(path.join(parentDir, 'package.json')) ?
        parentDir :
        path.join(parentDir, '..');
};
exports.moduleRoot = moduleRoot;
const finaliseConfig = (config) => {
    const finalConfig = { ...defaultConfig, ...config };
    if (!finalConfig.db || Object.keys(finalConfig.db).length < 1)
        throw new Error(`Zapatos needs database connection details`);
    return finalConfig;
};
exports.finaliseConfig = finaliseConfig;
