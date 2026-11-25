import { describe, expect, it } from 'vitest';
import { HOME_SECTION_TYPES, Theme } from '@/features/cms/settings/schema';
import { templateRegistry } from '../registry';
import { fallbackSections } from '../shared/fallbacks';

const keys = Theme.shape.template.options;

describe('template registry (MP §3.3, spec §6.1)', () => {
  it('has exactly one template per key, each under its own key', () => {
    expect(Object.keys(templateRegistry).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(templateRegistry[key].key).toBe(key);
    expect(new Set(keys.map((k) => templateRegistry[k].label)).size).toBe(keys.length);
  });

  it.each(keys)('%s has a header, footer and page frame', (key) => {
    const template = templateRegistry[key];
    expect(typeof template.Header).toBe('function');
    expect(typeof template.Footer).toBe('function');
    expect(typeof template.PageFrame).toBe('function');
  });

  it.each(keys)('%s can render every section type (its own design or the fallback)', (key) => {
    const template = templateRegistry[key];
    const missing = HOME_SECTION_TYPES.filter(
      (type) => !template.sections[type] && !fallbackSections[type],
    );
    expect(missing).toEqual([]);
  });

  it.each(keys)('%s lists every section type once in its default order', (key) => {
    const order = templateRegistry[key].defaults.homepageOrder;
    expect([...order].sort()).toEqual([...HOME_SECTION_TYPES].sort());
  });

  it('designs its signature sections itself (plan §3)', () => {
    expect(Object.keys(templateRegistry['institutional-classic'].sections)).toEqual(
      expect.arrayContaining(['hero', 'quickInfo', 'latestNews']),
    );
    expect(Object.keys(templateRegistry['modern-academic'].sections)).toEqual(
      expect.arrayContaining(['hero', 'introduction', 'statistics']),
    );
    expect(Object.keys(templateRegistry['heritage-prestige'].sections)).toEqual(
      expect.arrayContaining(['hero', 'statistics', 'leadershipMessage']),
    );
    expect(Object.keys(templateRegistry['contemporary-community'].sections)).toEqual(
      expect.arrayContaining(['hero', 'upcomingEvents', 'quickInfo']),
    );
  });
});
