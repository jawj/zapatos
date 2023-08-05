import {
  Column,
  ColumnForTable,
  InsertableForTable,
  SelectableForTable,
  Table,
} from "zapatos/schema";
import { FullLateralOption } from "./shortcuts";
import { SQLFragment } from "./core";

export interface Hook<U, V> {
  [t: Table]: { [c: Column]: (x: U) => V };
}

// TODO: narrow these types
const DESERIALIZE_HOOK: Hook<any, any> = {};
const SERIALIZE_HOOK: Hook<any, any> = {};

type InsertableOrSelectableForTable<T extends Table> =
  | InsertableForTable<T>
  | SelectableForTable<T>;
type InsertableOrSelectableForTableArray<T extends Table> =
  | InsertableForTable<T>[]
  | SelectableForTable<T>[];

function applyHook<
  T extends Table,
  V extends
    | InsertableOrSelectableForTable<T>
    | InsertableOrSelectableForTableArray<T>,
  U,
  W
>(hook: Hook<U, W>, table: Table, values: V, lateral?: FullLateralOption): V {
  return (
    Array.isArray(values)
      ? values.map<V>((v) => applyHookSingle(hook, table, v, lateral))
      : applyHookSingle(hook, table, values, lateral)
  ) as V;
}

function applyHookSingle<
  T extends Table,
  V extends InsertableOrSelectableForTable<T>,
  U,
  W
>(hook: Hook<U, W>, table: T, values: V, lateral?: FullLateralOption): V {
  const processed: V = {} as V;
  for (const [k, v] of Object.entries(values)) {
    const f = hook?.[table]?.[k];
    processed[k as T] = f ? f(v) : v;
  }
  if (lateral) {
    if (lateral instanceof SQLFragment) {
      // TODO: if json/jsonb is removed, we can remove this shim too
      const shim = { rows: [{ result: values }] };
      return lateral.runResultTransform(shim as any);
    } else {
      for (const [k, subQ] of Object.entries(lateral)) {
        processed[k as T] = processed[k]
          ? applyHook(hook, k as T, processed[k], subQ)
          : processed[k];
      }
    }
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
  values: SelectableForTable<T> | SelectableForTable<T>[] | undefined,
  lateral?: FullLateralOption
): undefined | SelectableForTable<T> | SelectableForTable<T>[] {
  if (!values) {
    return values;
  }
  return applyHook(DESERIALIZE_HOOK, table, values, lateral);
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
