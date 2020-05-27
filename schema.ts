/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

// this schema describes the system tables/views that we interrogate to generate the user's schema
// it is NOT auto-generated, since data on system tables doesn't show up in system tables!

import type {
  JSONValue,
  JSONArray,
  DateString,
  SQLFragment,
  SQL,
  GenericSQLExpression,
  ColumnNames,
  ColumnValues,
  ParentColumn,
  DefaultType,
} from "./src";

export namespace pg_indexes {
  export type Table = "pg_indexes";
  export interface Selectable {
    indexname: string;
    tablename: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace pg_class {
  export type Table = "pg_class";
  export interface Selectable {
    oid: number;
    relname: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace pg_index {
  export type Table = "pg_index";
  export interface Selectable {
    indexrelid: number;
    indisunique: boolean;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace pg_type {
  export type Table = "pg_type";
  export interface Selectable {
    typname: string;
    typnamespace: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace pg_enum {
  export type Table = "pg_enum";
  export interface Selectable {
    enumtypid: number;
    enumlabel: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace pg_namespace {
  export type Table = "pg_namespace";
  export interface Selectable {
    oid: number;
    nspname: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace information_schema.columns {
  export type Table = '"information_schema"."columns"';
  export interface Selectable {
    table_name: string;
    table_schema: string;
    column_name: string;
    udt_name: string;
    is_nullable: 'YES' | 'NO';
    column_default: string;
  }
  export interface Insertable extends Selectable { }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type UniqueIndex = never;
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export type Selectable = pg_indexes.Selectable | pg_class.Selectable | pg_index.Selectable | pg_type.Selectable | pg_enum.Selectable | pg_namespace.Selectable | information_schema.columns.Selectable;
export type Whereable = pg_indexes.Whereable | pg_class.Whereable | pg_index.Whereable | pg_type.Whereable | pg_enum.Whereable | pg_namespace.Whereable | information_schema.columns.Whereable;
export type Insertable = pg_indexes.Insertable | pg_class.Insertable | pg_index.Insertable | pg_type.Insertable | pg_enum.Insertable | pg_namespace.Insertable | information_schema.columns.Insertable;
export type Updatable = pg_indexes.Updatable | pg_class.Updatable | pg_index.Updatable | pg_type.Updatable | pg_enum.Updatable | pg_namespace.Updatable | information_schema.columns.Updatable;
export type Table = pg_indexes.Table | pg_class.Table | pg_index.Table | pg_type.Table | pg_enum.Table | pg_namespace.Table | information_schema.columns.Table;
export type UniqueIndex = pg_indexes.UniqueIndex | pg_class.UniqueIndex | pg_index.UniqueIndex | pg_type.UniqueIndex | pg_enum.UniqueIndex | pg_namespace.UniqueIndex | information_schema.columns.UniqueIndex;
export type Column = pg_indexes.Column | pg_class.Column | pg_index.Column | pg_type.Column | pg_enum.Column | pg_namespace.Column | information_schema.columns.Column;
export type AllTables = [pg_type.Table, pg_enum.Table, pg_namespace.Table, information_schema.columns.Table];


export type SelectableForTable<T extends Table> = {
  pg_indexes: pg_indexes.Selectable,
  pg_class: pg_class.Selectable,
  pg_index: pg_index.Selectable,
  pg_type: pg_type.Selectable,
  pg_enum: pg_enum.Selectable,
  pg_namespace: pg_namespace.Selectable,
  '"information_schema"."columns"': information_schema.columns.Selectable,
}[T];

export type WhereableForTable<T extends Table> = {
  pg_indexes: pg_indexes.Whereable,
  pg_class: pg_class.Whereable,
  pg_index: pg_index.Whereable,
  pg_type: pg_type.Whereable,
  pg_enum: pg_enum.Whereable,
  pg_namespace: pg_namespace.Whereable,
  '"information_schema"."columns"': information_schema.columns.Whereable,
}[T];

export type InsertableForTable<T extends Table> = {
  pg_indexes: pg_indexes.Insertable,
  pg_class: pg_class.Insertable,
  pg_index: pg_index.Insertable,
  pg_type: pg_type.Insertable,
  pg_enum: pg_enum.Insertable,
  pg_namespace: pg_namespace.Insertable,
  '"information_schema"."columns"': information_schema.columns.Insertable,
}[T];

export type UpdatableForTable<T extends Table> = {
  pg_indexes: pg_indexes.Updatable,
  pg_class: pg_class.Updatable,
  pg_index: pg_index.Updatable,
  pg_type: pg_type.Updatable,
  pg_enum: pg_enum.Updatable,
  pg_namespace: pg_namespace.Updatable,
  '"information_schema"."columns"': information_schema.columns.Updatable,
}[T];

export type UniqueIndexForTable<T extends Table> = {
  pg_indexes: pg_indexes.UniqueIndex,
  pg_class: pg_class.UniqueIndex,
  pg_index: pg_index.UniqueIndex,
  pg_type: pg_type.UniqueIndex,
  pg_enum: pg_enum.UniqueIndex,
  pg_namespace: pg_namespace.UniqueIndex,
  '"information_schema"."columns"': information_schema.columns.UniqueIndex,
}[T];

export type ColumnForTable<T extends Table> = {
  pg_indexes: pg_indexes.Column,
  pg_class: pg_class.Column,
  pg_index: pg_index.Column,
  pg_type: pg_type.Column,
  pg_enum: pg_enum.Column,
  pg_namespace: pg_namespace.Column,
  '"information_schema"."columns"': information_schema.columns.Column,
}[T];

export type SQLForTable<T extends Table> = {
  pg_indexes: pg_indexes.SQL,
  pg_class: pg_class.SQL,
  pg_index: pg_index.SQL,
  pg_type: pg_type.SQL,
  pg_enum: pg_enum.SQL,
  pg_namespace: pg_namespace.SQL,
  '"information_schema"."columns"': information_schema.columns.SQL,
}[T];
