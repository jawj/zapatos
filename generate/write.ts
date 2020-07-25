/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import { finaliseConfig } from './config';
import type { Config } from './config';
import { tsForConfig } from './tsOutput';

export const generate = async (suppliedConfig: Config) => {
  const
    config = finaliseConfig(suppliedConfig),
    log = config.progressListener === true ? console.log :
      config.progressListener || (() => void 0),

    ts = await tsForConfig(config),
    folderName = 'zapatos',
    schemaName = 'schema.d.ts',
    eslintrcName = '.eslintrc.json',
    folderTargetPath = path.join(config.outDir, folderName),

    eslintrcTargetPath = path.join(folderTargetPath, eslintrcName),
    schemaTargetPath = path.join(folderTargetPath, schemaName);

  if (!fs.existsSync(folderTargetPath)) fs.mkdirSync(folderTargetPath);

  if (!fs.existsSync(eslintrcTargetPath)) {
    log(`Writing local ESLint config: ${eslintrcTargetPath}`);
    fs.writeFileSync(eslintrcTargetPath, '{\n  "ignorePatterns": [\n    "*"\n  ]\n}', { flag: 'w' });
  }

  log(`Writing generated schema: ${schemaTargetPath}`);
  fs.writeFileSync(schemaTargetPath, ts, { flag: 'w' });
};
