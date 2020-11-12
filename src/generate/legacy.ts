
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
* Delete the file 'zapatos/schema.ts' (but leave 'zapatos/schema.d.ts')
` : ``) +
      (legacySrcExists ? `
* Delete the folder 'zapatos/src' and all its contents
` : ``) +
      (legacyCustomTypesExist ? `
* Transfer any customised type declarations in 'zapatos/custom' from the plain
  old '.ts' files to the new '.d.ts' files

* Delete all the plain '.ts' files in 'zapatos/custom', including 'index.ts'
` : ``) + `
* Ensure all the '.d.ts' files in 'zapatos' are picked up by your TypeScript
  configuration (e.g. check the "files" or "include" keys in 'tsconfig.json')

* If you use 'ts-node' or 'node -r ts-node/register', pass the --files option
  ('ts-node' only) or set 'TS_NODE_FILES=true' (in either case)

* Make the following changes to your imports (you can use VS Code's 'Replace in
  Files' command, just remember to toggle Regular Expressions on):

   1) Change:  import * as zapatos from 'zapatos'
      To:      import * as zapatos from 'zapatos/generate'

      Search:  ^(\\s*import[^"']*['"])zapatos(["'])
      Replace: $1zapatos/generate$2

   2) Change:  import * as db from './path/to/zapatos/src'
      To:      import * as db from 'zapatos/db'

      Search:  ^(\\s*import[^"']*['"])[^"']*/zapatos/src(["'])
      Replace: $1zapatos/db$2

   3) Change:  import * as s from './path/to/zapatos/schema'
      To:      import type * as s from 'zapatos/schema'
                      ^^^^
                      be sure to import type, not just import

      Search:  ^(\\s*import\\s*)(type\\s*)?([^"']*['"])[^"']+/(zapatos/schema["'])
      Replace: $1type $3$4

Thank you.
`);
  }
}
