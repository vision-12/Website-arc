import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/lib/auth/errors';

const requirePermission = vi.fn();
vi.mock('@/lib/auth/access', () => ({ requirePermission, requireUser: vi.fn() }));
vi.mock('@/lib/env/server', () => ({
  serverEnv: () => ({ PREVIEW_TOKEN_SECRET: 'a-test-secret-that-is-long-enough-to-sign-links' }),
}));

const { createPreviewToken } = await import('../actions');
const { verifyPreviewToken } = await import('../preview-token');

const userId = '6f1c0a52-3f3b-4d7a-9c55-0b8f0e7f2a11';

beforeEach(() => requirePermission.mockReset());

describe('createPreviewToken', () => {
  it('needs appearance.manage', async () => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError('appearance.manage'));
    const r = await createPreviewToken({ template: 'heritage-prestige' });
    expect(requirePermission).toHaveBeenCalledWith('appearance.manage');
    expect(r).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('rejects unknown templates before checking permission', async () => {
    const r = await createPreviewToken({ template: 'neon-dreams' });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('returns a preview link bound to the caller', async () => {
    requirePermission.mockResolvedValueOnce({ userId });
    const r = await createPreviewToken({ template: 'heritage-prestige' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const url = new URL(r.data.url, 'https://school.example');
    expect(url.pathname).toBe('/preview/template/heritage-prestige');
    const token = url.searchParams.get('t') ?? '';
    const verified = verifyPreviewToken(token, 'a-test-secret-that-is-long-enough-to-sign-links', {
      userId,
      template: 'heritage-prestige',
    });
    expect(verified.ok).toBe(true);
  });
});
