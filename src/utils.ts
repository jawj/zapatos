/*
** DON'T EDIT THIS FILE **
It's part of Zapatos, and will be overwritten when the database schema is regenerated

https://jawj.github.io/zapatos
Copyright (C) 2020 George MacKerron

This software is released under the MIT licence

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and / or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* tslint:disable */

import { Default } from './core';

/**
 * Simple promisification of setTimeout.
 * @param delayMs Time to wait, in milliseconds
 */
export const wait = (delayMs: number) => new Promise(resolve => setTimeout(resolve, delayMs));

/**
 * Map an input array to an output array, interspersing a constant separator value 
 * between the mapped values.
 * @param arr Input array
 * @param separator Separator value
 * @param cb Mapping function
 */
export const mapWithSeparator = <TIn, TSep, TOut>(
  arr: TIn[],
  separator: TSep,
  cb: (x: TIn, i: number, a: typeof arr) => TOut
): (TOut | TSep)[] => {

  const result: (TOut | TSep)[] = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    if (i > 0) result.push(separator);
    result.push(cb(arr[i], i, arr));
  }
  return result;
};

/**
 * Map an array of objects to an output array by taking the union of all objects' keys
 * and ensuring that any key not present on any object gets the value Default. 
 * 
 * `e.g. [{ x: 1 }, { y: 2 }] => [{ x: 1, y: Default }, { x: Default, y: 2}]`
 * @param objs The array of objects
 */
export const completeKeysWithDefault = <T extends object>(objs: T[]): T[] => {
  const unionKeys = Object.assign({}, ...objs);
  for (const k in unionKeys) unionKeys[k] = Default;
  return objs.map(o => ({ ...unionKeys, ...o }));
};
