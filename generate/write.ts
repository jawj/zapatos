/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import { finaliseConfig, Config } from './config';
import { tsForConfig } from './tsOutput';

export const customFolderName = 'custom';

export const generate = async (suppliedConfig: Config) => {
  const
    config = finaliseConfig(suppliedConfig),
    log = config.progressListener === true ? console.log :
      config.progressListener || (() => void 0),
    warn = config.warningListener === true ? console.log :
      config.warningListener || (() => void 0),

    { ts, customTypeSourceFiles } = await tsForConfig(config),
    folderName = 'zapatos',
    schemaName = 'schema.d.ts',
    folderTargetPath = path.join(config.outDir, folderName),

    schemaTargetPath = path.join(folderTargetPath, schemaName),
    customFolderTargetPath = path.join(folderTargetPath, customFolderName);


  fs.mkdirSync(folderTargetPath, { recursive: true });
  log(`Writing generated schema: ${schemaTargetPath}`);
  fs.writeFileSync(schemaTargetPath, ts, { flag: 'w' });

  if (Object.keys(customTypeSourceFiles).length > 0) {
    fs.mkdirSync(customFolderTargetPath, { recursive: true });

    for (const customTypeFileName in customTypeSourceFiles) {
      const customTypeFilePath = path.join(customFolderTargetPath, customTypeFileName + '.d.ts');
      if (fs.existsSync(customTypeFilePath)) {
        log(`Custom type or domain placeholder already exists: ${customTypeFilePath}`);

      } else {
        warn(`Writing new custom type or domain placeholder: ${customTypeFilePath}`);
        const customTypeFileContent = customTypeSourceFiles[customTypeFileName];
        fs.writeFileSync(customTypeFilePath, customTypeFileContent, { flag: 'w' });
      }
    }

  }
};
