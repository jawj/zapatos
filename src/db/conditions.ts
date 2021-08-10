/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2021 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import {
  SQLFragment,
  ParentColumn,
  Parameter,
  param,
  sql,
  GenericSQL,
  self,
  vals,
} from './core';

import { mapWithSeparator } from './utils';


const conditionalParam = (a: any) => a instanceof SQLFragment || a instanceof ParentColumn || a instanceof Parameter ? a : param(a);

export const isNull = sql<GenericSQL, boolean>`${self} IS NULL`;
export const isNotNull = sql<GenericSQL, boolean>`${self} IS NOT NULL`;
export const isTrue = sql<GenericSQL, boolean>`${self} IS TRUE`;
export const isNotTrue = sql<GenericSQL, boolean>`${self} IS NOT TRUE`;
export const isFalse = sql<GenericSQL, boolean>`${self} IS FALSE`;
export const isNotFalse = sql<GenericSQL, boolean>`${self} IS NOT FALSE`;
export const isUnknown = sql<GenericSQL, boolean>`${self} IS UNKNOWN`;
export const isNotUnknown = sql<GenericSQL, boolean>`${self} IS NOT UNKNOWN`;

export const isDistinctFrom = <T>(a: T) => sql<GenericSQL, boolean, T>`${self} IS DISTINCT FROM ${conditionalParam(a)}`;
export const isNotDistinctFrom = <T>(a: T) => sql<GenericSQL, boolean, T>`${self} IS NOT DISTINCT FROM ${conditionalParam(a)}`;

export const eq = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} = ${conditionalParam(a)}`;
export const ne = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} <> ${conditionalParam(a)}`;
export const gt = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} > ${conditionalParam(a)}`;
export const gte = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} >= ${conditionalParam(a)}`;
export const lt = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} < ${conditionalParam(a)}`;
export const lte = <T>(a: T) => sql<GenericSQL, boolean | null, T>`${self} <= ${conditionalParam(a)}`;

export const between = <T>(a: T, b: T) => sql<GenericSQL, boolean | null, T> `${self} BETWEEN (${conditionalParam(a)}) AND (${conditionalParam(b)})`;
export const betweenSymmetric = <T>(a: T, b: T) => sql<GenericSQL, boolean | null, T> `${self} BETWEEN SYMMETRIC (${conditionalParam(a)}) AND (${conditionalParam(b)})`;
export const notBetween = <T>(a: T, b: T) => sql<GenericSQL, boolean | null, T> `${self} NOT BETWEEN (${conditionalParam(a)}) AND (${conditionalParam(b)})`;
export const notBetweenSymmetric = <T>(a: T, b: T) => sql<GenericSQL, boolean | null, T> `${self} NOT BETWEEN SYMMETRIC (${conditionalParam(a)}) AND (${conditionalParam(b)})`;

export const like = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} LIKE ${conditionalParam(a)}`;
export const notLike = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} NOT LIKE ${conditionalParam(a)}`;
export const ilike = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} ILIKE ${conditionalParam(a)}`;
export const notIlike = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} NOT ILIKE ${conditionalParam(a)}`;
export const similarTo = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} SIMILAR TO ${conditionalParam(a)}`;
export const notSimilarTo = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} NOT SIMILAR TO ${conditionalParam(a)}`;
export const reMatch = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} ~ ${conditionalParam(a)}`;
export const reImatch = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} ~* ${conditionalParam(a)}`;
export const notReMatch = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} !~ ${conditionalParam(a)}`;
export const notReImatch = <T extends string>(a: T) => sql<GenericSQL, boolean | null, T>`${self} !~* ${conditionalParam(a)}`;

export const isIn = <T>(a: readonly T[]) => a.length > 0 ? sql<GenericSQL, boolean | null, T>`${self} IN (${vals(a)})` : sql`false`;
export const isNotIn = <T>(a: readonly T[]) => a.length > 0 ? sql<GenericSQL, boolean | null, T>`${self} NOT IN (${vals(a)})` : sql`true`;

export const or = <T>(...conditions: SQLFragment<any, T>[]) => sql<GenericSQL, boolean | null, T>`(${mapWithSeparator(conditions, sql` OR `, c => c)})`;
export const and = <T>(...conditions: SQLFragment<any, T>[]) => sql<GenericSQL, boolean | null, T>`(${mapWithSeparator(conditions, sql` AND `, c => c)})`;
export const not = <T>(condition: SQLFragment<any, T>) => sql<GenericSQL, boolean | null, T>`(NOT ${condition})`;

// things that aren't genuinely conditions
type IntervalUnit = 'microsecond' | 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'decade' | 'century' | 'millennium';
export const fromNow = (n: number, unit: IntervalUnit = 'millisecond') => sql`now() + ${param(String(n) + ' ' + unit)}`;
export const after = gt;
export const before = lt;

// these are really more operations than conditions, but we sneak them in here for now, for use e.g. in UPDATE queries
export const add = <T extends number | Date>(a: T) => sql<GenericSQL, number, T>`${self} + ${conditionalParam(a)}`;
export const subtract = <T extends number | Date>(a: T) => sql<GenericSQL, number, T>`${self} - ${conditionalParam(a)}`;
