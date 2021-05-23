/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import { DateString } from './core';

/**
 * Make a function `STRICT` in the Postgres sense — where it's an alias for
 * `RETURNS NULL ON NULL INPUT` — with appropriate typing. See the `toDate` and
 * `toUnixMs` functions as examples.
 * @param fn The transformation function to be made strict.
 */
export function strict<FnIn, FnOut>(fn: (x: FnIn) => FnOut): <T extends FnIn | null>(d: T) => T extends FnIn ? Exclude<T, FnIn> | FnOut : T {
  return function <T extends FnIn | null>(d: T) {
    return (d === null ? null : fn(d as FnIn)) as any;
  };
}

/**
 * Convert a `DateString` to a JavaScript `Date`. Nullability is preserved
 * (e.g. `DateString | null` input gives `Date | null` output), using `strict`.
 * Note: Postgres date-time types default to microsecond precision, but are
 * truncated to JavaScript's millisecond precision by this conversion.
 * @param d A `DateString` (or `null`) for conversion.
 */
export const toDate = strict((d: DateString) => new Date(d));

/**
 * Convert a `DateString` to milliseconds since 1 January 1970. Nullability is
 * preserved (e.g `DateString | null` becomes `number | null`) using `strict`.
 * Note: Postgres date-time types default to microsecond precision, but are
 * truncated to JavaScript's millisecond precision by this conversion.
 * @param d A `DateString` (or `null`) for conversion.
 */
export const toUnixMs = strict((d: DateString) => Date.parse(d));

/**
 * Convert a JavaScript `Date` or milliseconds since 1 January 1970 to a
 * `DateString`. Nullability is preserved (e.g. `Date | null` becomes
 * `DateString | null`), using `strict`.
 * @param d A `Date` or number (or `null`) for conversion.
 */
export const toDateString = strict((d: number | Date) => (typeof d === 'number' ? new Date(d) : d).toISOString() as DateString);
