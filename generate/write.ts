/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import * as fs from 'fs';
import * as path from 'path';
import { moduleRoot, finaliseConfig } from './config';
import type { Config } from './config';
import { tsForConfig } from './tsOutput';


const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

export const generate = async (suppliedConfig: Config) => {
  const
    config = finaliseConfig(suppliedConfig),
    log = config.progressListener === true ? console.log :
      config.progressListener || (() => void 0),

    ts = await tsForConfig(config),
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
    schemaTargetPath = path.join(folderTargetPath, schemaName);

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
};
