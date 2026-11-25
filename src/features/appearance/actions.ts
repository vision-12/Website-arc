'use server';
import 'server-only';
import type { Route } from 'next';
import { defineAction } from '@/lib/actions/define';
import { serverEnv } from '@/lib/env/server';
import { signPreviewToken } from './preview-token';
import { CreatePreviewInput } from './schema';

/**
 * A ten-minute link that shows the real homepage in a candidate template, with any unsaved theme
 * or homepage changes (spec §4.3, §6.4). Nothing is written: the token carries the changes and the
 * preview route merges them in memory. The link works only for the user who asked for it.
 */
export const createPreviewToken = defineAction({
  input: CreatePreviewInput,
  permission: 'appearance.manage',
  handler: ({ template, overrides }, { access }) => {
    const token = signPreviewToken(
      { userId: access.userId, template, ...(overrides ? { overrides } : {}) },
      serverEnv().PREVIEW_TOKEN_SECRET,
    );
    return Promise.resolve({
      url: `/preview/template/${template}?t=${encodeURIComponent(token)}` as Route,
    });
  },
});
