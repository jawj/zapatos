import type * as pg from 'pg';
export interface RequiredConfig {
    db: pg.ClientConfig;
}
export interface OptionalConfig {
    outDir: string;
    outExt: string;
    schemas: SchemaRules;
    debugListener: boolean | ((s: string) => void);
    progressListener: boolean | ((s: string) => void);
    warningListener: boolean | ((s: string) => void);
    customTypesTransform: 'PgMy_type' | 'my_type' | 'PgMyType' | ((s: string) => string);
    columnOptions: ColumnOptions;
    schemaJSDoc: boolean;
    unprefixedSchema: string | null;
}
interface SchemaRules {
    [schema: string]: {
        include: '*' | string[];
        exclude: '*' | string[];
    };
}
interface ColumnOptions {
    [k: string]: {
        [k: string]: {
            insert?: 'auto' | 'excluded' | 'optional';
            update?: 'auto' | 'excluded';
        };
    };
}
export type Config = RequiredConfig & Partial<OptionalConfig>;
export type CompleteConfig = RequiredConfig & OptionalConfig;
export declare const moduleRoot: () => string;
export declare const finaliseConfig: (config: Config) => CompleteConfig;
export {};
