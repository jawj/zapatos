import { Column, ColumnForTable, InsertableForTable, Table } from "zapatos/schema";

export interface Hook<U, V> {
  [t: Table]: { [c: Column]: (x: U) => V };
}

// TODO: narrow these types
const DESERIALIZE_HOOK: Hook<any, any> = {};
const SERIALIZE_HOOK: Hook<any, any> = {};

function applyHook<T extends Table, U, V>(
  hook: Hook<U, T>,
  table: Table,
  values: InsertableForTable<T> | InsertableForTable<T>[]
): InsertableForTable<T> | InsertableForTable<T>[] {
  return Array.isArray(values)
    ? values.map((v) => applyHookSingle(hook, table, v))
    : applyHookSingle(hook, table, values);
}

function applyHookSingle<T extends Table, U, V>(
  hook: Hook<U, V>,
  table: T,
  values: InsertableForTable<T>
): InsertableForTable<T> {
  const processed: InsertableForTable<T> = {};
  for (const [k, v] of Object.entries(values)) {
    const f = hook?.[table]?.[k];
    processed[k] = f ? f(v) : v;
  }
  return processed;
}

function registerHook<T extends Table, U, V>(
  hook: Hook<U, V>,
  table: T,
  column: ColumnForTable<T>,
  f: (x: U) => V
): void {
  if (!(table in hook)) {
    hook[table] = {};
  }
  hook[table][column] = f;
}

export function applyDeserializeHook<T extends Table>(
  table: T,
  values?: InsertableForTable<T> | InsertableForTable<T>[]
): undefined | InsertableForTable<T> | InsertableForTable<T>[] {
  if (!values) {
    return values;
  }
  return applyHook(DESERIALIZE_HOOK, table, values);
}

export function applySerializeHook<T extends Table>(
  table: T,
  values: InsertableForTable<T> | InsertableForTable<T>[]
): InsertableForTable<T> | InsertableForTable<T>[] {
  return applyHook(SERIALIZE_HOOK, table, values);
}

// TODO: f should only read native types
export function registerDeserializeHook<T extends Table, U>(
  table: T,
  column: Column,
  f: (x: any) => U
) {
  registerHook(DESERIALIZE_HOOK, table, column, f);
}

// TODO: f should only return native types
export function registerSerializeHook<T extends Table, U>(
  table: T,
  column: ColumnForTable<T>,
  f: (x: U) => any
) {
  registerHook(SERIALIZE_HOOK, table, column, f);
}

export function registerSerdeHook<T extends Table, U>(
  table: T,
  column: ColumnForTable<T>,
  {
    serialize,
    deserialize,
  }: {
    serialize?: (x: U) => any;
    deserialize?: (x: any) => U;
  }
) {
  if (deserialize) {
    registerDeserializeHook(table, column, deserialize);
  }
  if (serialize) {
    registerSerializeHook(table, column, serialize);
  }
}
