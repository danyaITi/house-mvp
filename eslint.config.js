import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { documentationRule } from './tooling/eslint/documentation.js'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      documentation: { rules: { 'require-description': documentationRule } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'documentation/require-description': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: '^(?:\\.{1,2}/|/)', message: 'Используйте алиас @/ для импортов из src.' }],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^\\./]',
          message: 'Используйте алиас @/ для динамических импортов из src.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs}', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
)
