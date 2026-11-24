import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'unit-test-form-signing-secret-0123456789';

beforeEach(() => {
  vi.stubEnv('SCHOOL_SLUG', 'demo-school');
  vi.stubEnv('CRON_SECRET', 'c'.repeat(40));
  vi.stubEnv('FORM_SIGNING_SECRET', SECRET);
  vi.stubEnv('IP_HASH_SALT', 's'.repeat(40));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('submission tickets (spec D5)', () => {
  it('signs purpose.sha256(payload).issuedAt.ipHash exactly as private.verify_ticket recomputes it', async () => {
    const { mintTicket } = await import('../ticket');
    const payload = JSON.stringify({ action: 'login', emailHash: 'abc' });
    const ticket = mintTicket('auth', payload, 'iphash', 1_700_000_000_000);
    const message = `auth.${createHash('sha256').update(payload).digest('hex')}.1700000000000.iphash`;
    expect(ticket).toEqual({
      issuedAt: '1700000000000',
      ipHash: 'iphash',
      mac: createHmac('sha256', SECRET).update(message).digest('hex'),
    });
  });

  it('binds the signature to purpose, payload and IP', async () => {
    const { mintTicket } = await import('../ticket');
    const base = mintTicket('auth', '{"a":1}', 'ip1', 1);
    expect(mintTicket('enquiry', '{"a":1}', 'ip1', 1).mac).not.toBe(base.mac);
    expect(mintTicket('auth', '{"a":2}', 'ip1', 1).mac).not.toBe(base.mac);
    expect(mintTicket('auth', '{"a":1}', 'ip2', 1).mac).not.toBe(base.mac);
  });

  it('takes the first X-Forwarded-For hop as the client IP', async () => {
    vi.doMock('next/headers', () => ({
      headers: () => Promise.resolve(new Headers({ 'x-forwarded-for': '41.210.1.2, 10.0.0.1' })),
    }));
    const { clientIp, currentIpHash, hashIp } = await import('../ip');
    expect(await clientIp()).toBe('41.210.1.2');
    expect(await currentIpHash()).toBe(hashIp('41.210.1.2'));
    vi.doUnmock('next/headers');
  });

  it('falls back when no proxy header is present', async () => {
    vi.doMock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
    const { clientIp } = await import('../ip');
    expect(await clientIp()).toBe('0.0.0.0');
    vi.doUnmock('next/headers');
  });

  it('hashes IPs and emails without exposing them', async () => {
    const { hashEmail, hashIp } = await import('../ip');
    expect(hashIp('197.239.1.10')).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp('197.239.1.10')).not.toContain('197');
    expect(hashEmail(' Head@School.test ')).toBe(hashEmail('head@school.test'));
  });
});
