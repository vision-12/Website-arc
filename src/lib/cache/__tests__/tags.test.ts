import { describe, expect, it } from 'vitest';
import { CacheTags } from '../tags';

describe('CacheTags', () => {
  it('builds namespaced per-entity tags', () => {
    expect(CacheTags.page('/about/history')).toBe('page:/about/history');
    expect(CacheTags.newsArticle('sports-day')).toBe('news:sports-day');
    expect(CacheTags.event('open-day')).toBe('event:open-day');
    expect(CacheTags.album('graduation')).toBe('album:graduation');
    expect(CacheTags.media('abc')).toBe('media:abc');
    expect(CacheTags.siteSettings).toBe('site-settings');
  });
});
