/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import { finaliseConfig, Config } from './config';
import * as legacy from './legacy';
import { tsForConfig } from './tsOutput';


/**
 * Generate a schema and supporting files and folders given a configuration.
 * @param suppliedConfig An object approximately matching `zapatosconfig.json`.
 */
export const generate = async (suppliedConfig: Config) => {
  const
    config = finaliseConfig(suppliedConfig),
    log = config.progressListener === true ? console.log :
      config.progressListener || (() => void 0),
    warn = config.warningListener === true ? console.log :
      config.warningListener || (() => void 0),
    debug = config.debugListener === true ? console.log :
      config.debugListener || (() => void 0),

    folderName = 'zapatos',
    schemaName = 'schema' + config.outExt,
    customFolderName = 'custom',
    eslintrcName = '.eslintrc.json',
    eslintrcContent = '{\n  "ignorePatterns": [\n    "*"\n  ]\n}',

    { ts, customTypeSourceFiles } = await tsForConfig({ ...config, customFolderName }, debug),

    folderTargetPath = path.join(config.outDir, folderName),
    schemaTargetPath = path.join(folderTargetPath, schemaName),
    customFolderTargetPath = path.join(folderTargetPath, customFolderName),
    eslintrcTargetPath = path.join(folderTargetPath, eslintrcName);

  log(`(Re)creating schema folder: ${schemaTargetPath}`);
  fs.mkdirSync(folderTargetPath, { recursive: true });

  log(`Writing generated schema: ${schemaTargetPath}`);
  fs.writeFileSync(schemaTargetPath, ts, { flag: 'w' });

  log(`Writing local ESLint config: ${eslintrcTargetPath}`);
  fs.writeFileSync(eslintrcTargetPath, eslintrcContent, { flag: 'w' });

  if (Object.keys(customTypeSourceFiles).length > 0) {
    fs.mkdirSync(customFolderTargetPath, { recursive: true });

    for (const customTypeFileName in customTypeSourceFiles) {
      const customTypeFilePath = path.join(customFolderTargetPath, customTypeFileName + config.outExt);
      if (fs.existsSync(customTypeFilePath)) {
        log(`Custom type or domain declaration file already exists: ${customTypeFilePath}`);

      } else {
        warn(`Writing new custom type or domain placeholder file: ${customTypeFilePath}`);
        const customTypeFileContent = customTypeSourceFiles[customTypeFileName];
        fs.writeFileSync(customTypeFilePath, customTypeFileContent, { flag: 'w' });
      }
    }
  }

  legacy.srcWarning(config);
};
