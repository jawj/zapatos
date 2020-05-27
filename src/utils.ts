/*
** DON'T EDIT THIS FILE (unless you're working on Zapatos) **
It's part of Zapatos, and will be overwritten when the database schema is regenerated

Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

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
