import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import js from "@eslint/js";

const
  __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
  });

export default [
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "prettier",
      "plugin:import/typescript"
    ),
  ), {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: fixupPluginRules(_import),
    },
    languageOptions: {
      globals: {
        ...globals.node,
        globalThis: false,
      },
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "module",
      parserOptions: {
        project: "tsconfig.json",
      },
    },
    rules: {
      "import/no-self-import": "warn",
      "import/no-cycle": "warn",
      "curly": ["error", "multi-line"],
      "no-template-curly-in-string": "error",
      "prefer-const": "error",
      "prefer-object-spread": "error",
      "radix": "error",
      "no-irregular-whitespace": ["error", {
        "skipComments": true,
      }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "varsIgnorePattern": "^_",
      }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/member-delimiter-style": ["error", {
        "multiline": {
          "delimiter": "semi",
          "requireLast": true,
        },
        "singleline": {
          "delimiter": "semi",
          "requireLast": false,
        },
      }],
      "@typescript-eslint/semi": ["error", "always"],
    },
  }
];
