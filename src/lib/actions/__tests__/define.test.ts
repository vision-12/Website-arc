import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ForbiddenError } from '@/lib/auth/errors';

const requirePermission = vi.fn();
const requireUser = vi.fn();
vi.mock('@/lib/auth/access', () => ({ requirePermission, requireUser }));

const { defineAction, defineUserAction } = await import('../define');

const access = { userId: '00000000-0000-0000-0000-000000000001' };

beforeEach(() => {
  requirePermission.mockReset();
  requireUser.mockReset();
});

describe('defineAction (MP §4.2 pipeline)', () => {
  const handler = vi.fn((input: { title: string }) => Promise.resolve({ saved: input.title }));
  const action = defineAction({
    input: z.object({ title: z.string().min(2) }),
    permission: 'news.create',
    handler,
  });

  it('validates before checking permission, and never runs the handler on bad input', async () => {
    const r = await action({ title: 'x' });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('checks the declared permission before the handler', async () => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError('news.create'));
    const r = await action({ title: 'Sports day' });
    expect(requirePermission).toHaveBeenCalledWith('news.create');
    expect(r).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns typed data on success', async () => {
    requirePermission.mockResolvedValueOnce(access);
    expect(await action({ title: 'Sports day' })).toEqual({
      ok: true,
      data: { saved: 'Sports day' },
    });
  });

  it('maps database errors thrown by the handler', async () => {
    requirePermission.mockResolvedValueOnce(access);
    const failing = defineAction({
      input: z.object({}),
      permission: 'pages.publish',
      handler: () =>
        Promise.reject(Object.assign(new Error('db'), { code: '40001', message: 'CONFLICT' })),
    });
    expect(await failing({})).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });
});

describe('defineUserAction', () => {
  it('requires a signed-in user but no permission key', async () => {
    requireUser.mockResolvedValueOnce(access);
    const action = defineUserAction({ input: z.object({}), handler: () => Promise.resolve('ok') });
    expect(await action({})).toEqual({ ok: true, data: 'ok' });
    expect(requirePermission).not.toHaveBeenCalled();
  });
});
