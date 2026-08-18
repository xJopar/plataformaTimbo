// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/src/generated/**'],
  },
  js.configs.recommended,
  {
    // Los archivos de configuración de herramientas (Jest, ESLint) son de confianza
    // y no participan del programa TypeScript de la aplicación.
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Nest declara módulos y controladores como clases vacías anotadas con decoradores.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  eslintConfigPrettier,
);
