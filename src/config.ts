
const config = {  // defaults
  transactionAttemptsMax: 5,
  transactionRetryDelay: { minMs: 25, maxMs: 250 },
  verbose: false,
};

export type Config = typeof config;
export type NewConfig = Partial<Config>;

/**
 * Get (a copy of) the current configuration.
 */
export const getConfig = () => Object.assign({}, config);

/**
 * Set key(s) on the configuration.
 * @param newConfig Partial configuration object
 */
export const setConfig = (newConfig: NewConfig) => Object.assign(config, newConfig);
