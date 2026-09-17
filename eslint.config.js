import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        __TAURI_INTERNALS__: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**', '*.config.js', '*.config.ts'],
  },
];
