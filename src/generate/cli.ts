#!/usr/bin/env node
// ^^ this shebang is for the compiled JS file, not the TS source

/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import { generate } from ".";
import type { Config } from './config';


const recursivelyInterpolateEnvVars = (obj: any): any =>
  typeof obj === 'string' ?
    obj.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_0, name) => {
      const e = process.env[name];
      if (e === undefined) throw new Error(`Environment variable '${name}' is not set`);
      return e;
    }) :
    Array.isArray(obj) ?
      obj.map(item => recursivelyInterpolateEnvVars(item)) :
      typeof obj === 'object' ?
        Object.keys(obj).reduce<any>((memo, key) => {
          memo[key] = recursivelyInterpolateEnvVars(obj[key]);
          return memo;
        }, {}) : obj;

void (async () => {
  const
    configFile = 'zapatosconfig.json',
    configJSON = fs.existsSync(configFile) ? fs.readFileSync(configFile, { encoding: 'utf8' }) : '{}',
    argsJSON = process.argv[2] ?? '{}';

  let fileConfig;
  try {
    fileConfig = recursivelyInterpolateEnvVars(JSON.parse(configJSON));
  } catch (err: any) {
    throw new Error(`If present, zapatosconfig.ts must be a valid JSON file: ${err.message}`);
  }

  let argsConfig;
  try {
    argsConfig = recursivelyInterpolateEnvVars(JSON.parse(argsJSON));
  } catch (err: any) {
    throw new Error(`If present, the argument to Zapatos must be valid JSON: ${err.message}`);
  }

  await generate({ ...fileConfig, ...argsConfig } as Config);
})();
