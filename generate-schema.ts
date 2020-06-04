#!/usr/bin/env node
// ^^ this shebang is for the compiled JS file, not the TS source

/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import { getConfig, generate } from "./generate";

void (async () => {
  const config = getConfig();
  await generate(config);
})();
