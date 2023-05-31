import type { CompleteConfig } from './config';
export interface CustomTypes {
    [name: string]: string;
}
export declare const tsForConfig: (config: CompleteConfig, debug: (s: string) => void) => Promise<{
    ts: string;
    customTypeSourceFiles: {
        [k: string]: string;
    };
}>;
