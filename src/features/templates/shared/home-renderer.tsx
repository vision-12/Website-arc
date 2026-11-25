import 'server-only';
import type { HomeSection, SiteSettings } from '@/features/cms/settings/schema';
import type { SectionComponent, SectionData, TemplateDefinition } from '../types';
import { fallbackSections } from './fallbacks';
import { parseSection, type HomeSectionType, type ParsedSection } from './section-settings';
import { loadSection } from './sections';

export interface PlannedSection {
  section: ParsedSection;
  data: SectionData[HomeSectionType];
}

/** Visible, valid sections in the school's order, with their data; empty ones are dropped. */
export async function planHome(
  sections: HomeSection[],
  settings: SiteSettings,
): Promise<PlannedSection[]> {
  const parsed = sections
    .filter((s) => s.visible)
    .map(parseSection)
    .filter((s): s is ParsedSection => s !== null);
  const loaded = await Promise.all(
    parsed.map(async (section) => ({ section, data: await loadSection(section, { settings }) })),
  );
  return loaded.filter((entry): entry is PlannedSection => entry.data !== null);
}

/**
 * Renders the homepage with any template. A section type the template doesn't design falls back
 * to the shared renderer, so switching templates never drops content (spec §6.3). The page has one
 * h1, the school's name: in the hero when the template puts it there, otherwise visually hidden.
 */
export function HomeSections({
  template,
  planned,
  settings,
}: {
  template: TemplateDefinition;
  planned: PlannedSection[];
  settings: SiteSettings;
}) {
  const heroHoldsTitle = template.homeTitle === 'hero' && planned[0]?.section.type === 'hero';
  return (
    <>
      {heroHoldsTitle ? null : <h1 className="sr-only">{settings.identity.name}</h1>}
      {planned.map(({ section, data }, index) => {
        // Keyed by type: the component for section.type always receives that type's data.
        const Component = (template.sections[section.type] ??
          fallbackSections[section.type]) as SectionComponent<HomeSectionType>;
        return (
          <Component
            key={section.id}
            id={`section-${section.id}`}
            data={data}
            locale={settings.locale}
            {...(heroHoldsTitle && index === 0 ? { schoolNameAsH1: settings.identity.name } : {})}
          />
        );
      })}
    </>
  );
}
