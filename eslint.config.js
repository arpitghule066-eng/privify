// @ts-check
/**
 * @file ESLint flat configuration for Privify.
 * Uses @eslint/js recommended rules plus custom bans for security.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    rules: {
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'complexity': ['error', 12],
      'max-lines-per-function': ['warn', 60],
      'no-restricted-properties': [
        'error',
        { object: 'document', property: 'write', message: 'Use createElement instead.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'AssignmentExpression[left.property.name="innerHTML"]', message: 'Use createElement + textContent instead of innerHTML.' },
        { selector: 'AssignmentExpression[left.property.name="outerHTML"]', message: 'Use createElement + textContent instead of outerHTML.' },
        { selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]', message: 'Use createElement + textContent instead of insertAdjacentHTML.' },
        { selector: 'CallExpression[callee.name="eval"]', message: 'eval is forbidden.' },
        { selector: 'NewExpression[callee.name="Function"]', message: 'new Function is forbidden.' },
      ],
    },
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', 'playwright.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    ignores: ['node_modules/', '_site/', 'coverage/', 'test-results/', 'playwright-report/', '.lighthouseci/', '.firebase/'],
  },
];
