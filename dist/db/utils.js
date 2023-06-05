"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPOJO = exports.completeKeysWithDefaultValue = exports.mapWithSeparator = exports.wait = exports.pad = void 0;
/**
 * Basic zero-padding for small, positive integers
 * @param n The integer to pad
 * @param pad The minimum desired output string length: 2, 3 or 4
 */
const pad = (n, pad = 2) => {
    const s = String(n);
    return '000'.slice(s.length + 3 - pad) + s;
};
exports.pad = pad;
/**
 * Simple promisification of setTimeout.
 * @param delayMs Time to wait, in milliseconds
 */
const wait = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));
exports.wait = wait;
/**
 * Map an input array to an output array, interspersing a constant separator value
 * between the mapped values.
 * @param arr Input array
 * @param separator Separator value
 * @param cb Mapping function
 */
const mapWithSeparator = (arr, separator, cb) => {
    const result = [];
    for (let i = 0, len = arr.length; i < len; i++) {
        if (i > 0)
            result.push(separator);
        result.push(cb(arr[i], i, arr));
    }
    return result;
};
exports.mapWithSeparator = mapWithSeparator;
/**
 * Map an array of objects to an output array by taking the union of all objects' keys
 * and ensuring that any key not present on any object gets a default value.
 *
 * `e.g. [{ x: 1 }, { y: 2 }] => [{ x: 1, y: defaultValue }, { x: defaultValue, y: 2}]`
 * @param objs The array of objects
 * @param defaultValue The default value to assign to missing keys for each object
 */
const completeKeysWithDefaultValue = (objs, defaultValue) => {
    const unionKeys = Object.assign({}, ...objs);
    for (const k in unionKeys)
        unionKeys[k] = defaultValue;
    return objs.map(o => ({ ...unionKeys, ...o }));
};
exports.completeKeysWithDefaultValue = completeKeysWithDefaultValue;
/**
 * Test that a value is a Plain Old JavaScript Object (such as one created by an object
 * literal, e.g. `{x: 1, y: 2}`)
 * @param x The value to test
 */
const isPOJO = (x) => typeof x === 'object' &&
    x !== null &&
    x.constructor === Object &&
    x.toString() === '[object Object]';
exports.isPOJO = isPOJO;
