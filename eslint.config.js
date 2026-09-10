import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node-Skripte ausserhalb des Browser-Bundles (Build-/Asset-Skripte).
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', fetch: 'readonly' },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      // Abhaengigkeitsrichtung der Architektur. `except` ist relativ zu `from`.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: './src',
              except: ['./domain'],
              message: 'domain darf nichts ausserhalb von domain importieren.',
            },
            {
              target: './src/adapters',
              from: './src',
              except: ['./adapters', './domain'],
              message: 'adapters darf nur domain importieren.',
            },
            {
              target: './src/services',
              from: './src',
              except: ['./services', './adapters', './domain'],
              message: 'services darf nur domain und adapters importieren.',
            },
            {
              target: './src/workers',
              from: './src',
              except: ['./workers', './adapters', './domain'],
              message: 'workers darf nur domain und adapters importieren.',
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
