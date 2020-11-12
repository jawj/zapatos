
import * as path from 'path';
import * as fs from 'fs';

import { CompleteConfig } from "./config";


const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

export function srcWarning(config: CompleteConfig) {
  const
    legacyFolderName = 'zapatos',
    legacyFolderPath = path.join(config.outDir, legacyFolderName),
    legacySchemaName = 'schema.ts',
    legacySchemaPath = path.join(legacyFolderPath, legacySchemaName),
    legacySchemaExists = fs.existsSync(legacySchemaPath),
    legacySrcName = 'src',
    legacySrcPath = path.join(legacyFolderPath, legacySrcName),
    legacySrcExists = fs.existsSync(legacySrcPath),
    legacyCustomName = 'custom',
    legacyCustomPath = path.join(legacyFolderPath, legacyCustomName),
    legacyCustomPathExists = fs.existsSync(legacyCustomPath),
    legacyCustomTypes = !legacyCustomPathExists ? [] :
      recurseNodes(legacyCustomPath).filter(f => !f.match(/[.]d[.]ts$/)),
    legacyCustomTypesExist = legacyCustomTypes.length > 0;

  if (legacySchemaExists || legacySrcExists || legacyCustomTypesExist) {
    const warn = config.warningListener === true ? console.log :
      config.warningListener || (() => void 0);

    warn(`
*** GOOD NEWS! ZAPATOS NO LONGER COPIES ITS SOURCE TO YOUR SOURCE TREE ***

To convert your codebase, please do the following:
` +
      (legacySchemaExists ? `
* Delete the file 'zapatos/schema.ts'
` : ``) +
      (legacySrcExists ? `
* Delete the folder 'zapatos/src' and all its contents
` : ``) +
      (legacyCustomTypesExist ? `
* Transfer any customised type declarations in 'zapatos/custom' from the old
  plain '.ts' files to the new '.d.ts' files

* Delete all the plain '.ts' files in 'zapatos/custom', including 'index.ts'
` : ``) + `
* If you use 'ts-node' or 'node -r ts-node/register', pass the --files option
  ('ts-node' only) or set 'TS_NODE_FILES=true' (either case)

* If you haven't yet updated your imports, make these changes:

   1) Change: import * as zapatos from 'zapatos'
      To:     import * as zapatos from 'zapatos/generate'

      /^(\\s*import[^"']*['"])zapatos(["'])/g
      -> $1zapatos/generate$2

   2) Change: import * as db from './path/to/zapatos/src'
      To:     import * as db from 'zapatos/db'

      /^(\\s*import[^"']*['"])[^"']*/zapatos/src(["'])/g 
      -> $1zapatos$2

   3) Change: import * as s from './path/to/zapatos/schema'
      To:     import type * as s from 'zapatos/schema'
                     ^^^^
                     be sure to import type, not just import

      /^(\\s*import\\s*)(type)?([^"']*['"])[^"']+/(zapatos/schema["'])/g 
      -> $1type$3$4

Thank you.
`);
  }
}
