"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.setConfig = exports.getConfig = void 0;
let config = {
    transactionAttemptsMax: 5,
    transactionRetryDelay: { minMs: 25, maxMs: 250 },
    castArrayParamsToJson: false,
    castObjectParamsToJson: false,
};
/**
 * Get (a copy of) the current configuration.
 */
const getConfig = () => ({ ...config });
exports.getConfig = getConfig;
/**
 * Set key(s) on the configuration.
 * @param newConfig Partial configuration object
 */
const setConfig = (newConfig) => config = { ...config, ...newConfig };
exports.setConfig = setConfig;
