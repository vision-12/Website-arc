import { describe, expect, it, vi } from 'vitest';
import { seededSettings } from '../../../../../test/support/demo-settings';

// Loaders reach the database; here they return a marker, or null for "nothing to show".
vi.mock('../sections', () => ({
  loadSection: vi.fn((section: { type: string }) =>
    Promise.resolve(section.type === 'testimonials' ? null : { marker: section.type }),
  ),
}));

const { planHome } = await import('../home-renderer');

describe('planHome: the homepage the school configured', () => {
  const settings = seededSettings();

  it('keeps the school’s order', async () => {
    const visible = settings.homepage.filter((s) => s.visible && s.type !== 'testimonials');
    const planned = await planHome(settings.homepage, settings);
    expect(planned.map((p) => p.section.id)).toEqual(visible.map((s) => s.id));
  });

  it('skips hidden sections, invalid settings and sections with nothing to show', async () => {
    const [first, second, third, ...rest] = settings.homepage;
    const sections = [
      { ...first!, visible: false },
      { ...second!, settings: { nonsense: true } },
      third!,
      ...rest,
    ];
    const planned = await planHome(sections, settings);
    const ids = planned.map((p) => p.section.id);
    expect(ids).not.toContain(first!.id);
    expect(ids).not.toContain(second!.id);
    expect(planned.some((p) => p.section.type === 'testimonials')).toBe(false);
    expect(ids[0]).toBe(third!.visible ? third!.id : ids[0]);
  });

  it('passes each loader its data through unchanged', async () => {
    const planned = await planHome(settings.homepage, settings);
    for (const p of planned) expect(p.data).toEqual({ marker: p.section.type });
  });
});
