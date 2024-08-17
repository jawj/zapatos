import { Column, ColumnForTable, InsertableForTable, SelectableForTable, Table, Whereable, WhereableForTable } from "zapatos/schema";
import { type FullLateralOption } from "./shortcuts";
export interface Hook<U, V> {
    [t: Table]: {
        [c: Column]: (x: U) => V;
    };
}
export declare const TYPE_HOOK: {
    [t: Table]: {
        [c: Column]: string;
    };
};
export declare function applyHookForWhere<T extends Table, U, W>(table: T, where: Whereable): InsertableForTable<T>;
export declare function applyDeserializeHook<T extends Table>(table: T, values: SelectableForTable<T> | SelectableForTable<T>[] | undefined, lateral?: FullLateralOption): undefined | SelectableForTable<T> | SelectableForTable<T>[];
export declare function applySerializeHook<T extends Table>(table: T, values: InsertableForTable<T> | InsertableForTable<T>[] | WhereableForTable<T>): InsertableForTable<T> | InsertableForTable<T>[] | WhereableForTable<T>;
export declare function registerDeserializeHook<T extends Table, U>(table: T, column: Column, f: (x: any) => U): void;
export declare function registerSerializeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, f: (x: U) => any): void;
export type SerdeHook<T> = {
    serialize?: (x: T) => any;
    deserialize?: (x: any) => T;
    type?: string;
};
export declare function registerSerdeHook<T extends Table, U>(table: T, column: ColumnForTable<T>, { serialize, deserialize, type }: SerdeHook<U>): void;
type SerdeTableMap<T extends Table> = Partial<Record<ColumnForTable<T>, SerdeHook<any>>>;
export declare function registerSerdeHooksForTable<T extends Table>(table: T, map: SerdeTableMap<T>): void;
export {};
