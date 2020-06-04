/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import type * as pg from 'pg';


interface SchemaRules {
  [schema: string]: {
    include: '*' | string[];
    exclude: '*' | string[];
  };
}

export interface Config {
  db: pg.ClientConfig;
  outDir: string;
  srcMode: 'symlink' | 'copy';
  schemas: SchemaRules;
}

export const moduleRoot = () => {
  // __dirname could be either ./generate (ts) or ./dist/generate (js)
  const parentDir = path.join(__dirname, '..');
  return fs.existsSync(path.join(parentDir, 'package.json')) ?
    parentDir :
    path.join(parentDir, '..');
};

const recursivelyInterpolateEnvVars = (obj: any): any =>
  typeof obj === 'string' ?
    obj.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, ($0, name) => {
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

export const getConfig = () => {
  const
    config: Config = {  // defaults
      db: {},
      outDir: '.',
      srcMode: 'copy',
      schemas: { public: { include: '*', exclude: [] } },
    },
    configFile = 'zapatosconfig.json',
    configJSON = fs.existsSync(configFile) ? fs.readFileSync(configFile, { encoding: 'utf8' }) : '{}',
    argsJSON = process.argv[2] ?? '{}';

  try {
    const fileConfig = JSON.parse(configJSON);
    Object.assign(config, fileConfig);
  } catch (err) {
    throw new Error(`If present, zapatosconfig.ts must be a valid JSON file: ${err.message}`);
  }

  try {
    const argsConfig = JSON.parse(argsJSON);
    Object.assign(config, argsConfig);
  } catch (err) {
    throw new Error(`If present, zapatos arguments must be valid JSON: ${err.message}`);
  }

  if (Object.keys(config.db).length < 1) throw new Error(`Zapatos needs database connection details`);

  const interpolatedConfig = recursivelyInterpolateEnvVars(config);
  return interpolatedConfig;
};