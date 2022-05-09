/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/

export interface SQLQuery {
  text: string;
  values: any[];
  name?: string;
}

export interface Config {
  transactionAttemptsMax: number;
  transactionRetryDelay: { minMs: number; maxMs: number };
  castArrayParamsToJson: boolean;   // see https://github.com/brianc/node-postgres/issues/2012
  castObjectParamsToJson: boolean;  // useful if json will be cast onward differently from text
  queryListener?(query: SQLQuery, txnId?: number): void;
  resultListener?(result: any, txnId?: number, elapsedMs?: number): void;
  transactionListener?(message: string, txnId?: number): void;
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
