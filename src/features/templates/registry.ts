import type { TemplateDefinition, TemplateKey } from './types';
import { contemporaryCommunity } from './contemporary-community';
import { heritagePrestige } from './heritage-prestige';
import { institutionalClassic } from './institutional-classic';
import { modernAcademic } from './modern-academic';

/** Template key → definition (MP §3.3). */
export const templateRegistry: Record<TemplateKey, TemplateDefinition> = {
  'institutional-classic': institutionalClassic,
  'modern-academic': modernAcademic,
  'heritage-prestige': heritagePrestige,
  'contemporary-community': contemporaryCommunity,
};

export function getTemplate(key: TemplateKey): TemplateDefinition {
  return templateRegistry[key];
}
