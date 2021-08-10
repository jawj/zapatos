/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

// this file exists only to suppress type errors when compiling the files in src/db

import type { GenericSQLStructure } from '../db/core';

declare module '../db/core' {
  interface StructureMap {
    SQLStructure: GenericSQLStructure;
  }
}
