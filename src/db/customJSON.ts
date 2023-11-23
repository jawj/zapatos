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
    if (str.length <= 15 || numericStringToExponential(str) === n.toExponential()) return n;
    return str;
  });
}

const numRe = /^(-?)(0|[1-9][0-9]*?)(0*)([.](0*)([0-9]*?)0*)?([eE]([-+]?)0*([0-9]+))?$/;

/**
 * Transform a valid numeric string into a format matching Number.prototype.toExponential()
 * @param str A numeric string
 * @returns str A numeric string reformatted to match Number.prototype.toExponential()
 */
function numericStringToExponential(str: string) {
  const match = str.match(numRe);
  if (!match) throw new Error(`Invalid numeric string: ${str}`);

  const [
    ,  // whole match
    srcMinus,
    srcDigitsPreDp,
    srcTrailingZeroesPreDp,
    ,  // decimal point and following digits
    srcLeadingZeroesPostDp,
    srcDigitsPostDp,
    ,  // e and exponent digits
    srcSignExp,
    srcDigitsExp
  ] = match;

  let exp = srcDigitsExp ? (srcSignExp === '-' ? -srcDigitsExp : +srcDigitsExp) : 0;
  let result = srcMinus;

  if (srcDigitsPreDp === '0') {
    // n === 0
    if (!srcDigitsPostDp) return '0e+0';

    // -1 < n < 1, n !== 0
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


// function testExpFromString(str) {
//   const
//     n = +str,
//     s1 = n.toExponential(),
//     s2 = expFromString(str);

//   if (s1 !== s2) throw new Error(`${s1} != ${s2}`);
// }

// function test() {
//   testExpFromString('0');
//   testExpFromString('0.000');
//   testExpFromString('0.00e+0');
//   testExpFromString('0e-00');
//   testExpFromString('1');
//   testExpFromString('12');
//   testExpFromString('120');
//   testExpFromString('1.2');
//   testExpFromString('1.002');
//   testExpFromString('1.9e200');
//   testExpFromString('1.9e-305');
//   testExpFromString('999999999999999');
//   testExpFromString('999999999999999e10');
//   testExpFromString('999999999999999e-10');
//   testExpFromString('1000000000000000');
//   testExpFromString('1.000000000000000');
//   testExpFromString('0.00000012300');
//   testExpFromString('0.00000090909e+3');
//   testExpFromString('0.00000090909e-3');
//   testExpFromString('10203040506070');
//   testExpFromString('102030405060708');
//   testExpFromString('1020304050607.0');
//   testExpFromString('1020304050607.08');
// }

// function exponentialFromNumericString(str: string) {
//   // note: this function can't handle zero, but that's OK, as it's only passed numbers with 15+ digits
//   if (str.indexOf('e') !== -1) return str;

//   const
//     negative = str.charCodeAt(0) === 45 /* - */,
//     firstDigitPos = negative ? 1 : 0,
//     pointPos = str.indexOf('.', firstDigitPos),
//     srcDigitsPreDp = str.slice(firstDigitPos, pointPos === -1 ? undefined : pointPos),
//     srcDigitsPostDp = pointPos === -1 ? '' : str.slice(pointPos + 1);

//   let result = negative ? '-' : '';
//   let exp;

//   if (srcDigitsPreDp === '0') {  // -1 < n < 1 (but n != 0)
//     zeroesRe.lastIndex = 0;
//     zeroesRe.test(srcDigitsPostDp);
//     const
//       firstNonZeroDigit = zeroesRe.lastIndex,
//       nextNonZeroDigit = firstNonZeroDigit + 1;

//     result += srcDigitsPostDp.charAt(firstNonZeroDigit);
//     if (srcDigitsPostDp.length > nextNonZeroDigit) result += '.' + srcDigitsPostDp.slice(nextNonZeroDigit);
//     exp = -nextNonZeroDigit;

//   } else {  // n <= -1, n >= 1
//     const
//       srcDigitsPreDpLen = srcDigitsPreDp.length,
//       shiftPointLeftBy = srcDigitsPreDpLen - 1;

//     result += srcDigitsPreDp.charAt(0);

//     let lastNonZeroDigit = srcDigitsPreDp.length - 1;
//     while (srcDigitsPreDp.charCodeAt(lastNonZeroDigit) === 48 /* zero */) lastNonZeroDigit -= 1;

//     const newDigitsPostDp = srcDigitsPreDp.slice(1, lastNonZeroDigit + 1) + srcDigitsPostDp;
//     if (newDigitsPostDp.length > 0) result += '.' + newDigitsPostDp;

//     exp = shiftPointLeftBy;
//   }

//   result += 'e' + (exp >= 0 ? '+' : '') + exp;
//   return result;
// }

// const zeroesRe = /^0*/y;

