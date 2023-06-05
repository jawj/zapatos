"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.toString = exports.toDate = void 0;
const utils_1 = require("./utils");
/**
 * Convert a `TimestampTzString`, `TimestampString` or `DateString` to a
 * JavaScript `Date`. For `TimestampString` and `DateString`, you must specify
 * whether the input is to be interpreted in the JavaScript environment's local
 * time or as UTC.
 *
 * Nullability is preserved (e.g. `TimestampTzString | null` input gives
 * `Date | null` output).
 *
 * _Note:_ Postgres date-time types default to microsecond precision, but must be
 * truncated to the millisecond precision of a JavaScript `Date` here.
 *
 * @param d A `TimestampTzString`, `TimestampString` or `DateString` (or
 * `null`) for conversion.
 * @param tzInterpretation For `TimestampString` or `DateString` input only,
 * `"UTC"` if the input is to be interpreted as UTC or `"local"` if it is to be
 * interpreted in the JavaScript environment's local time
 */
const toDate = function (d, tzInterpretation) {
    let dateMatch;
    if (d === null)
        return null;
    switch (tzInterpretation) {
        case undefined:
            return new Date(d);
        case 'UTC':
            return new Date(d + 'Z');
        case 'local':
            // new Date() interprets 'yyyy-mm-dd' as UTC but 'yyyy-mm-ddT00:00' as local
            if ((dateMatch = d.match(/^([0-9]+)-([0-9]+)-([0-9]+)$/))) {
                const [, y, m, d] = dateMatch;
                return new Date(parseInt(y, 10), parseInt(m, 10) - /* cRaZY jS */ 1, parseInt(d, 10));
            }
            return new Date(d);
    }
};
exports.toDate = toDate;
/**
 * Convert a JavaScript `Date` to a `TimestampTzString`, `TimestampString` or
 * `DateString`.
 *
 * For `TimestampString` and `DateString`, you must specify whether the input
 * is to be expressed in the JavaScript environment's local time or as UTC.
 *
 * Nullability is preserved (e.g. `Date | null` maps to something extending
 * `string | null`).
 *
 * @param d A `Date` (or `null`) for conversion.
 * @param stringTypeTz The pg type corresponding to the desired string format
 * and (except for `timestamptz`) whether to express in UTC or local time. For
 * example: `"timestamptz"`, `"timestamp:local"` or `"date:UTC"`.
 */
const toString = function (d, stringTypeTz) {
    if (d === null)
        return null;
    if (stringTypeTz === 'timestamptz')
        return d.toISOString();
    const [stringType, tz] = stringTypeTz.split(':'), utc = tz === 'UTC', year = (0, utils_1.pad)(utc ? d.getUTCFullYear() : d.getFullYear(), 4), month = (0, utils_1.pad)((utc ? d.getUTCMonth() : d.getMonth()) + /* cRaZY jS */ 1), day = (0, utils_1.pad)(utc ? d.getUTCDate() : d.getDate());
    if (stringType === 'date')
        return `${year}-${month}-${day}`;
    const hour = (0, utils_1.pad)(utc ? d.getUTCHours() : d.getHours()), min = (0, utils_1.pad)(utc ? d.getUTCMinutes() : d.getMinutes()), sec = (0, utils_1.pad)(utc ? d.getUTCSeconds() : d.getSeconds()), ms = (0, utils_1.pad)(utc ? d.getUTCMilliseconds() : d.getMilliseconds(), 3);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}`;
};
exports.toString = toString;
