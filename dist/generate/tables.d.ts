import * as pg from 'pg';
import type { EnumData } from './enums';
import type { CustomTypes } from './tsOutput';
import { CompleteConfig } from './config';
export interface Relation {
    schema: string;
    name: string;
    type: 'table' | 'view' | 'fdw' | 'mview';
    insertable: boolean;
}
export declare const relationsInSchema: (schemaName: string, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>) => Promise<Relation[]>;
export declare const definitionForRelationInSchema: (rel: Relation, schemaName: string, enums: EnumData, customTypes: CustomTypes, config: CompleteConfig, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>) => Promise<string>;
export declare const crossTableTypesForTables: (tables: Relation[]) => string;
export declare const crossSchemaTypesForAllTables: (allTables: Relation[], unprefixedSchema: string | null) => string;
export declare const crossSchemaTypesForSchemas: (schemas: string[]) => string;
