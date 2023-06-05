/**
 * An ISO8601-formatted date string, such as `"2021-05-25"`.
 */
export type DateString = `${number}-${number}-${number}`;
/**
 * An ISO8601-formatted time string, such as `"14:41"` or `"14:41:10.249"`.
 */
export type TimeString = `${number}:${number}${'' | `:${number}`}`;
/**
 * A timezone suffix string, such as `"Z"`, `"-02"`, or `"+01:00"`.
 */
export type TzSuffix = 'Z' | `${'+' | '-'}${number}${'' | `:${number}`}`;
/**
 * A time and timezone string, such as `"14:41:10+02"`. **Postgres docs advise
 * against use of this type except in legacy contexts.**
 */
export type TimeTzString = `${TimeString}${TzSuffix}`;
/**
 * An ISO8601-formatted date and time string **with no timezone**, such as
 * `"2021-05-25T14:41.10.249097"`.
 */
export type TimestampString = `${DateString}T${TimeString}`;
/**
 * An ISO8601-formatted date, time and (numeric) timezone string, such as
 * `"2021-05-25T14:41.10.249097+01:00"`.
 */
export type TimestampTzString = `${TimestampString}${TzSuffix}`;
type TzLocalOrUTC = 'UTC' | 'local';
interface ToDate {
    <D extends null | TimestampTzString>(d: D, tzInterpretation?: undefined): D extends null ? null : Date;
    <D extends null | TimestampString | DateString>(d: D, tzInterpretation: TzLocalOrUTC): D extends null ? null : Date;
}
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
export declare const toDate: ToDate;
interface ToString {
    <D extends Date | null, T extends 'timestamptz' | `${'timestamp' | 'date'}:${TzLocalOrUTC}`>(d: D, stringTypeTz: T): D extends null ? null : {
        'timestamptz': TimestampTzString;
        'timestamp:UTC': TimestampString;
        'timestamp:local': TimestampString;
        'date:UTC': DateString;
        'date:local': DateString;
    }[T];
}
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
export declare const toString: ToString;
export {};
