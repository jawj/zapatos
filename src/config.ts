
const config = {
  // defaults
  transactionAttemptsMax: 5,
  transactionRetryDelay: { minMs: 25, maxMs: 250 },
  verbose: false,
};

export type Config = typeof config;
export type NewConfig = Partial<Config>;

export const getConfig = () => Object.assign({}, config); // don't let anyone mess with the original
export const setConfig = (newConfig: NewConfig) => Object.assign(config, newConfig);
