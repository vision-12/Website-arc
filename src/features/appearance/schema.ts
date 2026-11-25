import { z } from 'zod';
import { HomeSection, Theme } from '@/features/cms/settings/schema';

/** The four template keys (spec §6.1). */
export const TemplateKey = Theme.shape.template;

/**
 * Unsaved changes a preview may show (spec §6.4): theme values other than the template, and a
 * homepage section list. They are merged into the saved settings in memory only.
 */
export const PreviewOverrides = z
  .object({
    theme: Theme.omit({ template: true }).partial().optional(),
    homepage: z.array(HomeSection).max(20).optional(),
  })
  .strict();
export type PreviewOverrides = z.infer<typeof PreviewOverrides>;

export const CreatePreviewInput = z.object({
  template: TemplateKey,
  overrides: PreviewOverrides.optional(),
});
