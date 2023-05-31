import { Config } from './config';
/**
 * Generate a schema and supporting files and folders given a configuration.
 * @param suppliedConfig An object approximately matching `zapatosconfig.json`.
 */
export declare const generate: (suppliedConfig: Config) => Promise<void>;
