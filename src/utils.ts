import { Default } from './core';


export const wait = (delayMs: number) => new Promise(resolve => setTimeout(resolve, delayMs));

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

export const completeKeysWithDefault = <T extends object>(objs: T[]): T[] => {
  // e.g. [{ x: 1 }, { y: 2 }] => [{ x: 1, y: Default }, { x: Default, y: 2}]
  const unionKeys = Object.assign({}, ...objs);
  for (let k in unionKeys) unionKeys[k] = Default;
  return objs.map(o => Object.assign({}, unionKeys, o));
};
