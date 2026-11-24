import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaims = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ auth: { getClaims }, rpc }),
}));
// React's cache() is a per-request memo; in unit tests every call should hit the mocks.
vi.mock('react', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));

const { can, getAccess, requirePermission, requireUser } = await import('../access');
const { ForbiddenError, MfaRequiredError, UnauthenticatedError } = await import('../errors');

const access = (over: Record<string, unknown> = {}) => ({
  userId: '3f1c2a9e-7b4d-4c8a-9e21-5d6f7a8b9c0d',
  fullName: 'Okello Admissions',
  email: 'ao@demo.test',
  status: 'active',
  mfaEnrolled: true,
  requiresMfa: false,
  isPlatformSupport: false,
  roles: ['Admissions Officer'],
  permissions: ['admissions.view', 'media.view'],
  sensitivePermissions: ['admissions.view'],
  ...over,
});

function signedIn(aal: 'aal1' | 'aal2', data: unknown) {
  getClaims.mockResolvedValue({ data: { claims: { sub: 'u', aal } }, error: null });
  rpc.mockImplementation((name: string) =>
    Promise.resolve(name === 'my_access' ? { data, error: null } : { data: null, error: null }),
  );
}

beforeEach(() => {
  getClaims.mockReset();
  rpc.mockReset();
});

describe('getAccess', () => {
  it('returns null when signed out', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getAccess()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('flags the MFA step when the role requires it and the session is aal1', async () => {
    signedIn('aal1', access({ requiresMfa: true }));
    expect((await getAccess())?.needsMfaStep).toBe(true);
    signedIn('aal2', access({ requiresMfa: true }));
    expect((await getAccess())?.needsMfaStep).toBe(false);
  });

  it('rejects malformed my_access payloads', async () => {
    signedIn('aal1', { userId: 'not-a-uuid' });
    expect(await getAccess()).toBeNull();
  });
});

describe('requireUser / requirePermission', () => {
  it('refuses signed-out and deactivated users', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    signedIn('aal1', access({ status: 'deactivated' }));
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses permissions the user lacks', async () => {
    signedIn('aal1', access());
    await expect(requirePermission('users.manage')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('requires the MFA step for sensitive permissions only', async () => {
    signedIn('aal1', access({ requiresMfa: true }));
    await expect(requirePermission('admissions.view')).rejects.toBeInstanceOf(MfaRequiredError);
    await expect(requirePermission('media.view')).resolves.toMatchObject({ email: 'ao@demo.test' });
  });

  it('audits every use of a support grant (MP §6)', async () => {
    signedIn('aal1', access({ isPlatformSupport: true }));
    await requirePermission('admissions.view');
    expect(rpc).toHaveBeenCalledWith(
      'log_activity',
      expect.objectContaining({ p_action: 'support.access', p_entity_id: 'admissions.view' }),
    );
    rpc.mockClear();
    await requirePermission('media.view');
    expect(rpc).not.toHaveBeenCalledWith('log_activity', expect.anything());
  });

  it('can() mirrors the permission set for UI decisions', async () => {
    signedIn('aal1', access());
    const a = await getAccess();
    expect(can(a, 'media.view')).toBe(true);
    expect(can(a, 'users.manage')).toBe(false);
    expect(can(null, 'media.view')).toBe(false);
  });
});
