export type NoInfer<T> = [T][T extends any ? 0 : never];
/**
 * Basic zero-padding for small, positive integers
 * @param n The integer to pad
 * @param pad The minimum desired output string length: 2, 3 or 4
 */
export declare const pad: (n: number, pad?: 2 | 3 | 4) => string;
/**
 * Simple promisification of setTimeout.
 * @param delayMs Time to wait, in milliseconds
 */
export declare const wait: (delayMs: number) => Promise<unknown>;
/**
 * Map an input array to an output array, interspersing a constant separator value
 * between the mapped values.
 * @param arr Input array
 * @param separator Separator value
 * @param cb Mapping function
 */
export declare const mapWithSeparator: <TIn, TSep, TOut>(arr: readonly TIn[], separator: TSep, cb: (x: TIn, i: number, a: readonly TIn[]) => TOut) => (TSep | TOut)[];
/**
 * Map an array of objects to an output array by taking the union of all objects' keys
 * and ensuring that any key not present on any object gets a default value.
 *
 * `e.g. [{ x: 1 }, { y: 2 }] => [{ x: 1, y: defaultValue }, { x: defaultValue, y: 2}]`
 * @param objs The array of objects
 * @param defaultValue The default value to assign to missing keys for each object
 */
export declare const completeKeysWithDefaultValue: <T extends object>(objs: T[], defaultValue: any) => T[];
/**
 * Test that a value is a Plain Old JavaScript Object (such as one created by an object
 * literal, e.g. `{x: 1, y: 2}`)
 * @param x The value to test
 */
export declare const isPOJO: (x: any) => boolean;
