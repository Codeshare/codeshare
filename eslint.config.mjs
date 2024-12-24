/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { dirname } from "path"
import { fileURLToPath } from "url"

import { FlatCompat } from "@eslint/eslintrc"
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin"
// import unusedImports from "@typescript-eslint/eslint-plugin"
import eslintPluginAlphabetize from "eslint-plugin-alphabetize"
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths"
import eslintPluginPrettier from "eslint-plugin-prettier"

import prettierConfig from "./.prettierrc.json" with { type: "json" }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: {},
})

const eslintConfig = [
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx", "**/*.mjs"],
  },
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ),
  {
    plugins: {
      alphabetize: eslintPluginAlphabetize,
      prettier: eslintPluginPrettier,
      "@typescript-eslint": typescriptEslintPlugin,
      "no-relative-import-paths": noRelativeImportPaths,
    },
    rules: {
      "alphabetize/_": "error",
      "prettier/prettier": ["error", prettierConfig],
      "no-relative-import-paths/no-relative-import-paths": [
        "error",
        // CAUTION: this is mirrored in tsconfig.json
        { allowSameFolder: true, rootDir: ".", prefix: "@" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // disable ALL rules for radix ui components
    ignores: ["components/ui/*", "lib/utils.ts", "**/resolvers/**"],
  },
]

export default eslintConfig
