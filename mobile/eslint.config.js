const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'node_modules/*'],
  },
  {
    // Scoped to TypeScript: the plugins these rules come from are only
    // registered for TS files by the Expo config, and referencing a rule whose
    // plugin is not in scope is a hard ESLint error.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Unused variables are an error, but an underscore prefix opts out —
      // useful for intentionally ignored callback arguments.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Keeps import blocks in a predictable order: packages, then `@/`
      // internals, then relative paths.
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
]);
