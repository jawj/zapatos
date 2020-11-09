/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import { moduleRoot, finaliseConfig } from './config';
import type { Config } from './config';
import { tsForConfig, header } from './tsOutput';

export const customFolderName = 'custom';

const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

export const generate = async (suppliedConfig: Config) => {
  const
    config = finaliseConfig(suppliedConfig),
    log = config.progressListener === true ? console.log :
      config.progressListener || (() => void 0),
    warn = config.warningListener === true ? console.log :
      config.warningListener || (() => void 0),

    { ts, customTypeSourceFiles, hasTables } = await tsForConfig(config),
    folderName = 'zapatos',
    srcName = 'src',
    licenceName = 'LICENCE',
    schemaName = 'schema.ts',
    eslintrcName = '.eslintrc.json',
    root = moduleRoot(),
    folderTargetPath = path.join(config.outDir, folderName),

    srcTargetPath = path.join(folderTargetPath, srcName),
    srcOriginPath = path.join(root, srcName),
    srcOriginPathRelative = path.relative(folderTargetPath, srcOriginPath),

    licenceTargetPath = path.join(folderTargetPath, licenceName),
    licenceOriginPath = path.join(root, licenceName),
    licenceOriginPathRelative = path.relative(folderTargetPath, licenceOriginPath),

    eslintrcTargetPath = path.join(folderTargetPath, eslintrcName),
    schemaTargetPath = path.join(folderTargetPath, schemaName),
    customFolderTargetPath = path.join(folderTargetPath, customFolderName);
	
  if (config.skipGenerateIfNoTables && !hasTables) {
    warn(
      `Generation of zapatos files skipped because 'skipGenerateIfNoTables' is set to 'true' and there are no tables in all configured schemas!`
    );
    return;
  }

  if (!fs.existsSync(folderTargetPath)) fs.mkdirSync(folderTargetPath);

  // TODO: deal with the case when we did have mode copy and now have mode symlink or vice versa

  if (config.srcMode === 'symlink') {
    if (fs.existsSync(srcTargetPath)) fs.unlinkSync(srcTargetPath);

    log(`Creating symlink: ${srcTargetPath} -> ${srcOriginPathRelative}`);
    fs.symlinkSync(srcOriginPathRelative, srcTargetPath);
    log(`Creating symlink: ${licenceTargetPath} -> ${licenceOriginPathRelative}`);
    fs.symlinkSync(licenceOriginPathRelative, licenceTargetPath);

  } else {
    const srcFiles = recurseNodes(srcOriginPath)
      .map(p => path.relative(srcOriginPath, p));

    for (const f of srcFiles) {
      const
        srcPath = path.join(srcOriginPath, f),
        targetDirPath = path.join(srcTargetPath, path.dirname(f)),
        targetPath = path.join(srcTargetPath, f);

      log(`Copying source file to ${targetPath}`);
      fs.mkdirSync(targetDirPath, { recursive: true });
      fs.copyFileSync(srcPath, targetPath);
    }
    log(`Copying licence file to ${licenceTargetPath}`);
    fs.copyFileSync(licenceOriginPath, licenceTargetPath);
  }

  log(`Writing local ESLint config: ${eslintrcTargetPath}`);
  fs.writeFileSync(eslintrcTargetPath, '{\n  "ignorePatterns": [\n    "*"\n  ]\n}', { flag: 'w' });

  log(`Writing generated schema: ${schemaTargetPath}`);
  fs.writeFileSync(schemaTargetPath, ts, { flag: 'w' });

  if (Object.keys(customTypeSourceFiles).length > 0) {
    let exportsFileContent = header();
    fs.mkdirSync(customFolderTargetPath, { recursive: true });

    for (const customTypeFileName in customTypeSourceFiles) {
      exportsFileContent += `export * from './${customTypeFileName}';\n`;

      const customTypeFilePath = path.join(customFolderTargetPath, customTypeFileName + '.ts');
      if (fs.existsSync(customTypeFilePath)) {
        log(`Custom type or domain placeholder already exists: ${customTypeFilePath}`);

      } else {
        warn(`Writing new custom type or domain placeholder: ${customTypeFilePath}`);
        const customTypeFileContent = customTypeSourceFiles[customTypeFileName];
        fs.writeFileSync(customTypeFilePath, customTypeFileContent, { flag: 'w' });
      }
    }

    const exportsFilePath = path.join(customFolderTargetPath, 'index.ts');
    fs.writeFileSync(exportsFilePath, exportsFileContent, { flag: 'w' });
  }
};
