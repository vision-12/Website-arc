import type { TemplateDefinition, TemplateKey } from './types';
import { institutionalClassic } from './institutional-classic';

/**
 * Template key → definition (MP §3.3). In development: modern-academic, heritage-prestige and
 * contemporary-community get their own designs in Phase 3 step 2.
 */
export const templateRegistry: Record<TemplateKey, TemplateDefinition> = {
  'institutional-classic': institutionalClassic,
  'modern-academic': { ...institutionalClassic, key: 'modern-academic' },
  'heritage-prestige': { ...institutionalClassic, key: 'heritage-prestige' },
  'contemporary-community': { ...institutionalClassic, key: 'contemporary-community' },
};

export function getTemplate(key: TemplateKey): TemplateDefinition {
  return templateRegistry[key];
}
