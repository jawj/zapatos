import { Column, Insertable, Table } from "zapatos/schema";
export interface Hook<U, T> {
    [t: Table]: {
        [c: Column]: (x: U) => T;
    };
}
export declare function applyDeserializeHook(table: Table, values?: Insertable | Insertable[]): undefined | Insertable | Insertable[];
export declare function applySerializeHook(table: Table, values: Insertable | Insertable[]): Insertable | Insertable[];
export declare function registerDeserializeHook<T>(table: Table, column: Column, f: (x: any) => T): void;
export declare function registerSerializeHook<T>(table: Table, column: Column, f: (x: T) => any): void;
export declare function registerSerdeHook<T>(table: Table, column: Column, { serialize, deserialize, }: {
    serialize?: (x: T) => any;
    deserialize?: (x: any) => T;
}): void;
