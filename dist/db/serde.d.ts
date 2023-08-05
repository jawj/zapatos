import { Column, ColumnForTable, InsertableForTable, SelectableForTable, Table } from "zapatos/schema";
import { FullLateralOption } from "./shortcuts";
export interface Hook<U, V> {
    [t: Table]: {
        [c: Column]: (x: U) => V;
    };
}
export declare function applyDeserializeHook<T extends Table>(table: T, values: SelectableForTable<T> | SelectableForTable<T>[] | undefined, lateral?: FullLateralOption): undefined | SelectableForTable<T> | SelectableForTable<T>[];
export declare function applySerializeHook<T extends Table>(table: T, values: InsertableForTable<T> | InsertableForTable<T>[]): InsertableForTable<T> | InsertableForTable<T>[];
export declare function registerDeserializeHook<T extends Table, U>(table: T, column: Column, f: (x: any) => U): void;
export declare function registerSerializeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, f: (x: U) => any): void;
export declare function registerSerdeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, { serialize, deserialize, }: {
    serialize?: (x: U) => any;
    deserialize?: (x: any) => U;
}): void;
