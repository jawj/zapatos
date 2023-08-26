import { Column, ColumnForTable, InsertableForTable, SelectableForTable, Table, WhereableForTable } from "zapatos/schema";
import { type FullLateralOption } from "./shortcuts";
export interface Hook<U, V> {
    [t: Table]: {
        [c: Column]: (x: U) => V;
    };
}
export declare function applyDeserializeHook<T extends Table>(table: T, values: SelectableForTable<T> | SelectableForTable<T>[] | undefined, lateral?: FullLateralOption): undefined | SelectableForTable<T> | SelectableForTable<T>[];
export declare function applySerializeHook<T extends Table>(table: T, values: InsertableForTable<T> | InsertableForTable<T>[] | WhereableForTable<T>): InsertableForTable<T> | InsertableForTable<T>[] | WhereableForTable<T>;
export declare function registerDeserializeHook<T extends Table, U>(table: T, column: Column, f: (x: any) => U): void;
export declare function registerSerializeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, f: (x: U) => any): void;
export type SerdeHook<T> = {
    serialize?: (x: T) => any;
    deserialize?: (x: any) => T;
};
export declare function registerSerdeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, { serialize, deserialize }: SerdeHook<U>): void;
type SerdeTableMap<T extends Table> = Partial<Record<ColumnForTable<T>, SerdeHook<any>>>;
export declare function registerSerdeHooksForTable<T extends Table>(table: T, map: SerdeTableMap<T>): void;
export {};
