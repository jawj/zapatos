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
    const n = +str;  // hex etc. is rejected by JSON parser, so don't need parseInt(str, 10)
    if (n === Infinity || n === -Infinity) return str;
    if (str.length <= 15) return n;  // float64 always gives >=15sf, so if it's not too big (caught above) it must be representable
    if (Big(str).cmp(Big(n)) !== 0) return str;  // expensive, which is why we try the shortcuts above first
    return n;
  });
}

export function enableCustomJSONParsingForLargeNumbers(pg: typeof pgLib) {
  pg.types.setTypeParser(pg.types.builtins.JSON, parseJSONWithLargeNumbersAsStrings);
  pg.types.setTypeParser(pg.types.builtins.JSONB, parseJSONWithLargeNumbersAsStrings);
}
