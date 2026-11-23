import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

const ADMIN_CLIENT_ALLOWED = [
  'src/app/api/cron/**',
  'src/app/api/webhooks/**',
  'scripts/**',
  'src/lib/supabase/admin.ts',
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),

  // Type-aware strictness for application code.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      // MP §7.5: never inject user content as HTML. JSON-LD will get a single reviewed exception.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is banned (MP §7.5). Render rich text with the Tiptap static renderer.',
        },
      ],
    },
  },

  // MP §4.2: the secret-key client is only for cron, webhooks and provisioning scripts.
  {
    files: ['**/*.{ts,tsx,mts,mjs}'],
    ignores: ADMIN_CLIENT_ALLOWED,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase/admin',
              message:
                'The secret-key client is only allowed in app/api/cron, app/api/webhooks and scripts (CLAUDE.md).',
            },
          ],
          patterns: [
            {
              group: ['**/lib/supabase/admin', '**/lib/supabase/admin.ts'],
              message:
                'The secret-key client is only allowed in app/api/cron, app/api/webhooks and scripts (CLAUDE.md).',
            },
            { group: ['@supabase/auth-helpers-*'], message: 'Use @supabase/ssr (MP §2.4).' },
          ],
        },
      ],
    },
  },

  // Playwright fixtures call `use()`, which is not React's hook.
  { files: ['e2e/**'], rules: { 'react-hooks/rules-of-hooks': 'off' } },

  // Tests may use non-null assertions and loose typing for fixtures.
  {
    files: ['**/__tests__/**', 'e2e/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
]);
