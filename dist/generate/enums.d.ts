import * as pg from 'pg';
export type EnumData = {
    [k: string]: string[];
};
export declare const enumDataForSchema: (schemaName: string, queryFn: (q: pg.QueryConfig) => Promise<pg.QueryResult<any>>) => Promise<EnumData>;
export declare const enumTypesForEnumData: (enums: EnumData) => string;
