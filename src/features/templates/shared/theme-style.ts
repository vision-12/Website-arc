import type { CSSProperties } from 'react';
import type { Theme } from '@/features/cms/settings/schema';
import { buildThemeVars } from '../theme/build-theme-vars';

/**
 * A candidate theme as CSS custom properties for a wrapper's style attribute. Used by the preview
 * and demo routes to show unsaved colours and fonts without a new stylesheet: style attributes are
 * allowed by the CSP (style-src-attr), and React drops nonces on hoisted <style> tags (ADR-000).
 */
export function themeStyle(theme: Theme): CSSProperties {
  return buildThemeVars(theme);
}
