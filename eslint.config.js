import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

const appsScriptRuntimeGlobals = {
  ContentService: "readonly",
  console: "readonly",
  DriveApp: "readonly",
  LockService: "readonly",
  MimeType: "readonly",
  PropertiesService: "readonly",
  ScriptApp: "readonly",
  UrlFetchApp: "readonly",
  Utilities: "readonly"
};

const appsScriptProjectGlobals = Object.fromEntries(
  [
    "ALLOWED_EXACT_UPLOAD_MIME_TYPES",
    "ALLOWED_MEDIA_TYPES",
    "ALLOWED_MEDIA_UPLOAD_ERROR_CODES",
    "ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS",
    "DEFAULT_SCRIPT_PROPERTIES",
    "MEDIA_UPLOAD_CHUNK_BYTES",
    "MEDIA_UPLOAD_KEY_PATTERN",
    "MEDIA_UPLOAD_KEY_PROPERTY",
    "MAX_UPLOAD_BYTES",
    "SETTING_KEYS",
    "createHttpError",
    "deleteMedia",
    "ensureDefaultScriptProperties",
    "ensureFolders",
    "getResource",
    "getSetting",
    "jsonResponse",
    "parsePayload",
    "queryMediaUploadStatus",
    "setSetting",
    "startMediaUpload",
    "uploadMediaChunk",
    "upsertMedia",
    "validateRequired",
    "withScriptLock"
  ].map((name) => [name, "readonly"])
);

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", ".vercel/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2023
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    files: [
      "api/**/*.{js,mjs}",
      "server/**/*.{js,mjs}",
      "scripts/**/*.{js,mjs}",
      "cloudflare/public-api/scripts/**/*.{js,mjs}",
      "*.config.{js,mjs,ts}"
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2023
      }
    }
  },
  {
    files: ["cloudflare/public-api/scripts/**/*.{js,mjs}"],
    rules: {
      // These scripts retain explicit /* global */ contracts for direct execution.
      "no-redeclare": "off"
    }
  },
  {
    files: ["cloudflare/public-api/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.worker,
        ...globals.es2023
      }
    }
  },
  {
    files: ["cloudflare/public-api/test/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2023
      }
    }
  },
  {
    files: ["apps-script/**/*.gs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.es2023,
        ...appsScriptRuntimeGlobals,
        ...appsScriptProjectGlobals
      }
    },
    rules: {
      // Apps Script loads .gs files into one shared global scope and invokes
      // entrypoints externally, so file-local unused analysis is misleading.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-redeclare": "off",
      // These expressions intentionally reject control characters in filenames.
      "no-control-regex": "off"
    }
  },
  eslintConfigPrettier
);
