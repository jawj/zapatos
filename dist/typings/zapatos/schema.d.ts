export interface Updatable {
    [k: string]: any;
}
export interface Whereable {
    [k: string]: any;
}
export interface Insertable {
    [k: string]: any;
}
export type Table = string;
export type Column = string;
export type JSONSelectableForTable<T extends Table> = {
    [k: string]: any;
};
export type SelectableForTable<T extends Table> = {
    [k: string]: any;
};
export type WhereableForTable<T extends Table> = {
    [k: string]: any;
};
export type InsertableForTable<T extends Table> = {
    [k: string]: any;
};
export type UpdatableForTable<T extends Table> = {
    [k: string]: any;
};
export type ColumnForTable<T extends Table> = string;
export type UniqueIndexForTable<T extends Table> = string;
export type SQLForTable<T extends Table> = any;
