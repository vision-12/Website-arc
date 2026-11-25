import { describe, expect, it } from 'vitest';
import type { HomeSection } from '@/features/cms/settings/schema';
import { HOME_SECTION_TYPES } from '@/features/cms/settings/schema';
import { parseSection, SECTION_MAX, SECTION_SETTINGS } from '../section-settings';

const MEDIA = '3f0c7d4e-8a51-4c3b-9f7e-2d1a6b5c4e30';
const doc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
};
const section = (type: HomeSection['type'], settings: Record<string, unknown>): HomeSection => ({
  id: `s-${type}`,
  type,
  visible: true,
  settings,
});

describe('section settings (spec §6.3)', () => {
  it('defines settings and a limit for every homepage section type', () => {
    expect(Object.keys(SECTION_SETTINGS).sort()).toEqual([...HOME_SECTION_TYPES].sort());
    expect(Object.keys(SECTION_MAX).sort()).toEqual([...HOME_SECTION_TYPES].sort());
    expect(SECTION_MAX.customRichText).toBe(5);
  });

  it('accepts 1–5 hero slides with an optional call to action', () => {
    const slide = {
      mediaId: MEDIA,
      heading: 'Welcome',
      cta: { label: 'Visit us', href: '/contact' },
    };
    const parsed = parseSection(section('hero', { slides: [slide] }));
    expect(parsed?.type).toBe('hero');
    expect(parsed?.type === 'hero' && parsed.settings.autoplaySeconds).toBe(7);
    expect(parseSection(section('hero', { slides: [] }))).toBeNull();
    expect(parseSection(section('hero', { slides: Array(6).fill(slide) }))).toBeNull();
    expect(parseSection(section('hero', { slides: [slide], autoplaySeconds: 2 }))).toBeNull();
    expect(
      parseSection(section('hero', { slides: [slide], autoplaySeconds: null })),
    ).not.toBeNull();
  });

  it('rejects links that are neither site paths nor https', () => {
    const slide = {
      mediaId: MEDIA,
      heading: 'Hi',
      cta: { label: 'Go', href: 'javascript:alert(1)' },
    };
    expect(parseSection(section('hero', { slides: [slide] }))).toBeNull();
  });

  it('fills defaults for module sections so a bare section is valid', () => {
    const news = parseSection(section('latestNews', {}));
    expect(news).toEqual({
      id: 's-latestNews',
      type: 'latestNews',
      settings: { heading: 'Latest news', count: 3, categoryId: null },
    });
  });

  it('bounds the key numbers and quick facts lists', () => {
    const item = { value: '1,200', label: 'Pupils' };
    expect(parseSection(section('statistics', { items: [item] }))).toBeNull();
    expect(parseSection(section('statistics', { items: [item, item] }))).not.toBeNull();
    const fact = { icon: 'calendar', label: 'Term starts', value: '3 February' };
    expect(parseSection(section('quickInfo', { items: Array(7).fill(fact) }))).toBeNull();
    expect(parseSection(section('quickInfo', { items: [{ ...fact, icon: 'rocket' }] }))).toBeNull();
  });

  it('requires a rich-text document where a section has body text', () => {
    expect(parseSection(section('customRichText', { body: doc }))).not.toBeNull();
    expect(parseSection(section('customRichText', { body: '<p>html</p>' }))).toBeNull();
    expect(
      parseSection(section('introduction', { heading: 'About us', body: doc })),
    ).not.toBeNull();
  });
});
