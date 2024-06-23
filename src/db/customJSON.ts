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

const { MAX_SAFE_INTEGER, MIN_SAFE_INTEGER } = Number;

function parseJSONWithLargeNumbersAsStrings(str: string) {
  return parse(str, undefined, function (k, str) {
    const n = +str;  // JSON parser ensures this is an ordinary number, parseInt(str, 10) not needed
    if (n === Infinity || n === -Infinity) return str;
    if ((n < MIN_SAFE_INTEGER || n > MAX_SAFE_INTEGER) && str.indexOf('.') === -1) return str;
    if (str.length <= 15 || numericStringToExponential(str) === n.toExponential()) return n;
    return str;
  });
}

const numRe = /^(-?)(0|[1-9][0-9]*?)(0*)([.](0*)([0-9]*?)0*)?([eE]([-+]?)0*([0-9]+))?$/;

/**
 * Transform a valid numeric string (any length and precision) into a format 
 * that matches Number.prototype.toExponential()
 * @param str A numeric string
 * @returns str The string reformatted to match n.toExponential()
 */
function numericStringToExponential(str: string) {
  const match = str.match(numRe);
  if (!match) throw new Error(`Invalid numeric string: ${str}`);

  const [
    /* discard whole match */, srcMinus, srcDigitsPreDp, srcTrailingZeroesPreDp,
    /* discard decimal point + following digits */, srcLeadingZeroesPostDp, srcDigitsPostDp,
    /* discard e + sign + exponent digits */, srcSignExp, srcDigitsExp,
  ] = match;

  let exp = srcDigitsExp ? (srcSignExp === '-' ? -srcDigitsExp : +srcDigitsExp) : 0;
  let result = srcMinus;

  if (srcDigitsPreDp === '0') {
    // n === 0
    if (!srcDigitsPostDp) return '0e+0';

    // n !== 0, -1 < n < 1
    exp -= srcLeadingZeroesPostDp.length + 1;
    result += srcDigitsPostDp.charAt(0);

    if (srcDigitsPostDp.length > 1) result += '.' + srcDigitsPostDp.slice(1);

  } else {
    // n <= -1, n >= 1
    exp += srcTrailingZeroesPreDp.length + srcDigitsPreDp.length - 1;
    result += srcDigitsPreDp.charAt(0);

    if (srcDigitsPreDp.length > 1 || srcDigitsPostDp) {
      result += '.' + srcDigitsPreDp.slice(1);
      if (srcDigitsPostDp) {
        result += srcTrailingZeroesPreDp;
        if (srcLeadingZeroesPostDp) result += srcLeadingZeroesPostDp;
        result += srcDigitsPostDp;
      }
    }
  }

  result += 'e' + (exp >= 0 ? '+' : '') + exp;
  return result;
}


// function testExpFromString(str: string) {
//   const
//     n = +str,
//     s1 = n.toExponential(),
//     s2 = numericStringToExponential(str);

//   if (s1 !== s2) throw new Error(`${s1} != ${s2}`);
//   console.log(`${s1}: pass`);
// }

// function test() {
//   for (const s of [
//     '0',
//     '0.000',
//     '0.00e+0',
//     '0e-00',
//     '-0e-00',
//     '1',
//     '-1',
//     '12',
//     '120',
//     '1.2',
//     '1.002',
//     '-1.002',
//     '1.9e200',
//     '1.900e-305',
//     '999999999999999',
//     '999999999999999e10',
//     '-999999999999999e10',
//     '999999999999999e-10',
//     '-999999999999999e-10',
//     '-9999990.099999990e-10',
//     '-999999.99999990e-10',
//     '1000000000000000',
//     '8000000000000008',
//     '8000000000008.808',
//     '8000000000080.080',
//     '8000000000080.080e080',
//     '1.000000000000000',
//     '0.000000000000001',
//     '0.000000000000005e20',
//     '0.000000000000005e-20',
//     '0.00000012300',
//     '0.00000090909e+3',
//     '0.00000090909e-3',
//     '0.000000909090e-03',
//     '10203040506070',
//     '102030405060708',
//     '1020304050607.0',
//     '1020304050607.08',
//   ]) testExpFromString(s);
// }

// test();
