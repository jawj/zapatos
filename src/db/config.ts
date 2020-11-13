/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

export interface Config {
  transactionAttemptsMax: number;
  transactionRetryDelay: { minMs: number; maxMs: number };
  castArrayParamsToJson: boolean;   // see https://github.com/brianc/node-postgres/issues/2012
  castObjectParamsToJson: boolean;  // useful if json will be cast onward differently from text
  queryListener?(str: any, txnId?: number): void;
  resultListener?(str: any, txnId?: number): void;
  transactionListener?(str: any, txnId?: number): void;
}
export type NewConfig = Partial<Config>;

let config: Config = {  // defaults
  transactionAttemptsMax: 5,
  transactionRetryDelay: { minMs: 25, maxMs: 250 },
  castArrayParamsToJson: false,
  castObjectParamsToJson: false,
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
