import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', 'scripts/**']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Import hooks from @harborclient/sdk/react'
            },
            {
              name: 'react/jsx-runtime',
              message: 'Set jsxImportSource to @harborclient/sdk'
            },
            {
              name: 'react-dom',
              message: 'Do not bundle react-dom in plugins'
            }
          ]
        }
      ]
    }
  },
  {
    // The JSX runtime shim must use the host React module directly so that
    // third-party deps importing react/jsx-runtime share the host instance.
    files: ['src/reactJsxRuntimeShim.js'],
    rules: {
      'no-restricted-imports': 'off'
    }
  }
);
