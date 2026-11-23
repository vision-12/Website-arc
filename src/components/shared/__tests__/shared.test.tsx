// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FALLBACK_SETTINGS } from '@/features/cms/settings/fallback';
import { SiteSettings } from '@/features/cms/settings/schema';
import { SaveStateIndicator } from '../save-state-indicator';
import { StatusBadge } from '../status-badge';

describe('shared admin components (browser environment)', () => {
  it('announces save state politely', () => {
    render(<SaveStateIndicator state="unsaved" />);
    const status = screen.getByRole('status');
    expect(status).toHaveProperty('textContent', 'Not saved — check your connection');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('uses plain lifecycle labels', () => {
    render(<StatusBadge status="in_review" />);
    expect(screen.getByText('Waiting for approval')).toBeDefined();
  });

  it('validates SiteSettings with the same schema the server uses', () => {
    expect(SiteSettings.safeParse(FALLBACK_SETTINGS).success).toBe(true);
    const bad = { ...FALLBACK_SETTINGS, theme: { ...FALLBACK_SETTINGS.theme, primary: 'red' } };
    expect(SiteSettings.safeParse(bad).success).toBe(false);
  });
});
