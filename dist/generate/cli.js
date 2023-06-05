#!/usr/bin/env node
"use strict";
// ^^ this shebang is for the compiled JS file, not the TS source
Object.defineProperty(exports, "__esModule", { value: true });
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
const fs = require("fs");
const _1 = require(".");
const recursivelyInterpolateEnvVars = (obj) => 
// string? => do the interpolation
typeof obj === 'string' ?
    obj.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_0, name) => {
        const e = process.env[name];
        if (e === undefined)
            throw new Error(`Environment variable '${name}' is not set`);
        return e;
    }) :
    // array? => recurse over its items
    Array.isArray(obj) ?
        obj.map(item => recursivelyInterpolateEnvVars(item)) :
        // object? => recurse over its values (but don't touch the keys)
        obj !== null && typeof obj === 'object' ?
            Object.keys(obj).reduce((memo, key) => {
                memo[key] = recursivelyInterpolateEnvVars(obj[key]);
                return memo;
            }, {}) :
            // anything else (e.g. number)? => pass right through
            obj;
void (async () => {
    var _a;
    const configFile = 'zapatosconfig.json', configJSON = fs.existsSync(configFile) ? fs.readFileSync(configFile, { encoding: 'utf8' }) : '{}', argsJSON = (_a = process.argv[2]) !== null && _a !== void 0 ? _a : '{}';
    let fileConfig;
    try {
        fileConfig = recursivelyInterpolateEnvVars(JSON.parse(configJSON));
    }
    catch (err) {
        throw new Error(`If present, zapatosconfig.json must be a valid JSON file, and all referenced environment variables must exist: ${err.message}`);
    }
    let argsConfig;
    try {
        argsConfig = recursivelyInterpolateEnvVars(JSON.parse(argsJSON));
    }
    catch (err) {
        throw new Error(`If present, the argument to Zapatos must be valid JSON, and all referenced environment variables must exist: ${err.message}`);
    }
    await (0, _1.generate)({ ...fileConfig, ...argsConfig });
})();
