"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const fs = require("fs");
const path = require("path");
const config_1 = require("./config");
const legacy = require("./legacy");
const tsOutput_1 = require("./tsOutput");
const header_1 = require("./header");
/**
 * Generate a schema and supporting files and folders given a configuration.
 * @param suppliedConfig An object approximately matching `zapatosconfig.json`.
 */
const generate = async (suppliedConfig) => {
    const config = (0, config_1.finaliseConfig)(suppliedConfig), log = config.progressListener === true ? console.log :
        config.progressListener || (() => void 0), warn = config.warningListener === true ? console.log :
        config.warningListener || (() => void 0), debug = config.debugListener === true ? console.log :
        config.debugListener || (() => void 0), { ts, customTypeSourceFiles } = await (0, tsOutput_1.tsForConfig)(config, debug), folderName = 'zapatos', schemaName = 'schema' + config.outExt, customFolderName = 'custom', eslintrcName = '.eslintrc.json', eslintrcContent = '{\n  "ignorePatterns": [\n    "*"\n  ]\n}', customTypesIndexName = 'index' + config.outExt, customTypesIndexContent = (0, header_1.header)() + `
// this empty declaration appears to fix relative imports in other custom type files
declare module 'zapatos/custom' { }
`, folderTargetPath = path.join(config.outDir, folderName), schemaTargetPath = path.join(folderTargetPath, schemaName), customFolderTargetPath = path.join(folderTargetPath, customFolderName), eslintrcTargetPath = path.join(folderTargetPath, eslintrcName), customTypesIndexTargetPath = path.join(customFolderTargetPath, customTypesIndexName);
    log(`(Re)creating schema folder: ${schemaTargetPath}`);
    fs.mkdirSync(folderTargetPath, { recursive: true });
    log(`Writing generated schema: ${schemaTargetPath}`);
    fs.writeFileSync(schemaTargetPath, ts, { flag: 'w' });
    log(`Writing local ESLint config: ${eslintrcTargetPath}`);
    fs.writeFileSync(eslintrcTargetPath, eslintrcContent, { flag: 'w' });
    if (Object.keys(customTypeSourceFiles).length > 0) {
        fs.mkdirSync(customFolderTargetPath, { recursive: true });
        for (const customTypeFileName in customTypeSourceFiles) {
            const customTypeFilePath = path.join(customFolderTargetPath, customTypeFileName + config.outExt);
            if (fs.existsSync(customTypeFilePath)) {
                log(`Custom type or domain declaration file already exists: ${customTypeFilePath}`);
            }
            else {
                warn(`Writing new custom type or domain placeholder file: ${customTypeFilePath}`);
                const customTypeFileContent = customTypeSourceFiles[customTypeFileName];
                fs.writeFileSync(customTypeFilePath, customTypeFileContent, { flag: 'w' });
            }
        }
        log(`Writing custom types file: ${customTypesIndexTargetPath}`);
        fs.writeFileSync(customTypesIndexTargetPath, customTypesIndexContent, { flag: 'w' });
    }
    legacy.srcWarning(config);
};
exports.generate = generate;
