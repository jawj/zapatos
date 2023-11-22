/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2023 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import { parse } from 'json-custom-numbers';
import type * as pgLib from 'pg';

export function enableCustomJSONParsingForLargeNumbers(pg: typeof pgLib) {
  pg.types.setTypeParser(pg.types.builtins.JSON, parseJSONWithLargeNumbersAsStrings);
  pg.types.setTypeParser(pg.types.builtins.JSONB, parseJSONWithLargeNumbersAsStrings);
}

function parseJSONWithLargeNumbersAsStrings(str: string) {
  return parse(str, undefined, function (k, str) {
    const n = +str;  // hex etc. is rejected by JSON parser, so don't need parseInt(str, 10)
    if (n === Infinity || n === -Infinity) return str;
    if (str.length <= 15 || exponentialFromNumericString(str) === n.toExponential()) return n;
    return str;
  });
}

function exponentialFromNumericString(str: string) {
  // note: this function can't handle zero, but that's OK, as it's only passed numbers with 15+ digits
  if (str.indexOf('e') !== -1) return str;

  const
    negative = str.charCodeAt(0) === 45 /* - */,
    firstDigitPos = negative ? 1 : 0,
    pointPos = str.indexOf('.', firstDigitPos),
    srcDigitsPreDp = str.slice(firstDigitPos, pointPos === -1 ? undefined : pointPos),
    srcDigitsPostDp = pointPos === -1 ? '' : str.slice(pointPos + 1);

  let result = negative ? '-' : '';
  let exp;

  if (srcDigitsPreDp === '0') {  // -1 < n < 1 (but n != 0)
    zeroesRe.lastIndex = 0;
    zeroesRe.test(srcDigitsPostDp);
    const
      firstNonZeroDigit = zeroesRe.lastIndex,
      nextNonZeroDigit = firstNonZeroDigit + 1;

    result += srcDigitsPostDp.charAt(firstNonZeroDigit);
    if (srcDigitsPostDp.length > nextNonZeroDigit) result += '.' + srcDigitsPostDp.slice(nextNonZeroDigit);
    exp = -nextNonZeroDigit;

  } else {  // n <= -1, n >= 1
    const
      srcDigitsPreDpLen = srcDigitsPreDp.length,
      shiftPointLeftBy = srcDigitsPreDpLen - 1;

    result += srcDigitsPreDp.charAt(0);

    let lastNonZeroDigit = srcDigitsPreDp.length - 1;
    while (srcDigitsPreDp.charCodeAt(lastNonZeroDigit) === 48 /* zero */) lastNonZeroDigit -= 1;

    const newDigitsPostDp = srcDigitsPreDp.slice(1, lastNonZeroDigit + 1) + srcDigitsPostDp;
    if (newDigitsPostDp.length > 0) result += '.' + newDigitsPostDp;

    exp = shiftPointLeftBy;
  }

  result += 'e' + (exp >= 0 ? '+' : '') + exp;
  return result;
}

const zeroesRe = /^0*/y;
