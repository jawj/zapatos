/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2023 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import { parse } from 'json-custom-numbers';
import * as Big from 'big.js';
import type * as pgLib from 'pg';

function parseJSONWithLargeNumbersAsStrings(str: string) {
  return parse(str, undefined, function (k, str) {
    const
      n = +str,  // anything non-decimal will be rejected by the JSON parser, so no need for parseInt(n, 10)
      safe = Number.isSafeInteger(n) || (Number.isFinite(n) && Big(str).eq(Big(n))),
      result = safe ? n : str;

    return result;
  });
}

export function enableCustomJSONParsingForLargeNumbers(pg: typeof pgLib) {
  pg.types.setTypeParser(pg.types.builtins.JSON, parseJSONWithLargeNumbersAsStrings);
  pg.types.setTypeParser(pg.types.builtins.JSONB, parseJSONWithLargeNumbersAsStrings);
}
