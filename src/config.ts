
/* tslint:disable */

export interface Config {
  transactionAttemptsMax: number;
  transactionRetryDelay: { minMs: number, maxMs: number };
  queryListener?(str: any): void;
  resultListener?(str: any): void;
};
export type NewConfig = Partial<Config>;

let config: Config = {  // defaults
  transactionAttemptsMax: 5,
  transactionRetryDelay: { minMs: 25, maxMs: 250 },
};

/**
 * Get (a copy of) the current configuration.
 */
export const getConfig = () => ({ ...config });

/**
 * Set key(s) on the configuration.
 * @param newConfig Partial configuration object
 */
export const setConfig = (newConfig: NewConfig) =>
  config = { ...config, ...newConfig };
