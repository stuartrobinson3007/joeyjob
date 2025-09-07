import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly", 
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        process: "readonly",
        Buffer: "readonly",
        React: "readonly",
        Image: "readonly",
        confirm: "readonly",
        alert: "readonly",
        requestAnimationFrame: "readonly",
        require: "readonly",
        NodeJS: "readonly"
      },
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': react,
      'react-hooks': reactHooks,
      'import': importPlugin
    },
    rules: {
      // Basic code quality rules
      "no-unused-vars": "off", // Use TypeScript version instead
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",
      
      // React specific rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-react": "off", // Not needed with new JSX transform
      "react/react-in-jsx-scope": "off", // Not needed with new JSX transform
      
      // TypeScript specific
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      
      // Import organization
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always"
      }],
      
      // Custom error handling rules
      "no-empty": ["error", { "allowEmptyCatch": false }]
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];