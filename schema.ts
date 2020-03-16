
// this schema describes the system tables/views that we interrogate to generate the user's schema
// it is NOT auto-generated, since data on system tables doesn't show up in system tables!

import {
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

export namespace pg_type {
  export type Table = "pg_type";
  export interface Selectable {
    typname: string;
    typnamespace: string;
  };
  export interface Insertable extends Selectable { };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
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
  };
  export interface Insertable extends Selectable { };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
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
  };
  export interface Insertable extends Selectable { };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
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
  };
  export interface Insertable extends Selectable { };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export type Selectable = pg_type.Selectable | pg_enum.Selectable | pg_namespace.Selectable | information_schema.columns.Selectable;
export type Whereable = pg_type.Whereable | pg_enum.Whereable | pg_namespace.Whereable | information_schema.columns.Whereable;
export type Insertable = pg_type.Insertable | pg_enum.Insertable | pg_namespace.Insertable | information_schema.columns.Insertable;
export type Updatable = pg_type.Updatable | pg_enum.Updatable | pg_namespace.Updatable | information_schema.columns.Updatable;
export type Table = pg_type.Table | pg_enum.Table | pg_namespace.Table | information_schema.columns.Table;
export type Column = pg_type.Column | pg_enum.Column | pg_namespace.Column | information_schema.columns.Column;
export type AllTables = [pg_type.Table, pg_enum.Table, pg_namespace.Table, information_schema.columns.Table];


export type SelectableForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.Selectable :
  T extends pg_enum.Table ? pg_enum.Selectable :
  T extends pg_namespace.Table ? pg_namespace.Selectable :
  T extends information_schema.columns.Table ? information_schema.columns.Selectable :
  Selectable;

export type WhereableForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.Whereable :
  T extends pg_enum.Table ? pg_enum.Whereable :
  T extends pg_namespace.Table ? pg_namespace.Whereable :
  T extends information_schema.columns.Table ? information_schema.columns.Whereable :
  Whereable;

export type InsertableForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.Insertable :
  T extends pg_enum.Table ? pg_enum.Insertable :
  T extends pg_namespace.Table ? pg_namespace.Insertable :
  T extends information_schema.columns.Table ? information_schema.columns.Insertable :
  Insertable;

export type UpdatableForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.Updatable :
  T extends pg_enum.Table ? pg_enum.Updatable :
  T extends pg_namespace.Table ? pg_namespace.Updatable :
  T extends information_schema.columns.Table ? information_schema.columns.Updatable :
  Updatable;

export type ColumnForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.Column :
  T extends pg_enum.Table ? pg_enum.Column :
  T extends pg_namespace.Table ? pg_namespace.Column :
  T extends information_schema.columns.Table ? information_schema.columns.Column :
  Column;

export type SQLForTable<T extends Table> =
  T extends pg_type.Table ? pg_type.SQL :
  T extends pg_enum.Table ? pg_enum.SQL :
  T extends pg_namespace.Table ? pg_namespace.SQL :
  T extends information_schema.columns.Table ? information_schema.columns.SQL :
  SQL;
