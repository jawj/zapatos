"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditions = exports.mapWithSeparator = exports.registerSerializeHook = exports.registerSerdeHooksForTable = exports.registerSerdeHook = exports.registerDeserializeHook = void 0;
__exportStar(require("./canary"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./core"), exports);
__exportStar(require("./date"), exports);
__exportStar(require("./pgErrors"), exports);
var serde_1 = require("./serde");
Object.defineProperty(exports, "registerDeserializeHook", { enumerable: true, get: function () { return serde_1.registerDeserializeHook; } });
Object.defineProperty(exports, "registerSerdeHook", { enumerable: true, get: function () { return serde_1.registerSerdeHook; } });
Object.defineProperty(exports, "registerSerdeHooksForTable", { enumerable: true, get: function () { return serde_1.registerSerdeHooksForTable; } });
Object.defineProperty(exports, "registerSerializeHook", { enumerable: true, get: function () { return serde_1.registerSerializeHook; } });
__exportStar(require("./shortcuts"), exports);
__exportStar(require("./transaction"), exports);
var utils_1 = require("./utils");
Object.defineProperty(exports, "mapWithSeparator", { enumerable: true, get: function () { return utils_1.mapWithSeparator; } });
exports.conditions = require("./conditions");
