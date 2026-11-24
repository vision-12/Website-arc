import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../../../../test/support/supabase';
import { hashEmail } from '../ip';
import { mintTicket } from '../ticket';

/** Proves the TypeScript signer and the SQL verifier agree (spec D5), and the login limiter works. */
describe('submission tickets × private.verify_ticket', () => {
  const ipHash = () => `int-${randomUUID()}`;
  const call = (ticket: { issuedAt: string; ipHash: string; mac: string }, payload: string) =>
    anonClient().rpc('rate_limit_check_auth', { p_ticket: ticket, p_payload: payload });

  it('accepts a freshly minted ticket', async () => {
    const payload = JSON.stringify({
      action: 'login',
      emailHash: hashEmail(`${randomUUID()}@x.test`),
    });
    const { data, error } = await call(mintTicket('auth', payload, ipHash()), payload);
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('rejects a tampered payload, a replay and an expired ticket', async () => {
    const payload = JSON.stringify({
      action: 'login',
      emailHash: hashEmail(`${randomUUID()}@x.test`),
    });
    const ticket = mintTicket('auth', payload, ipHash());
    const tampered = await call(ticket, payload.replace('login', 'reset'));
    expect(tampered.error?.message).toBe('TICKET_INVALID');

    expect((await call(ticket, payload)).error).toBeNull();
    expect((await call(ticket, payload)).error?.message).toBe('TICKET_INVALID'); // single use

    const old = mintTicket('auth', payload, ipHash(), Date.now() - 5 * 60_000);
    expect((await call(old, payload)).error?.message).toBe('TICKET_INVALID');
  });

  it('refuses the 11th login attempt for one email within the hour and audits the burst once', async () => {
    const emailHash = hashEmail(`${randomUUID()}@x.test`);
    const results: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      const payload = JSON.stringify({ action: 'login', emailHash });
      const { data } = await call(mintTicket('auth', payload, ipHash()), payload);
      results.push(data === true);
    }
    expect(results.slice(0, 10).every(Boolean)).toBe(true);
    expect(results.slice(10)).toEqual([false, false]);
    const { data: logs } = await adminClient()
      .from('activity_logs')
      .select('action, metadata')
      .eq('action', 'auth.login_burst')
      .contains('metadata', { emailHash });
    expect(logs).toHaveLength(1);
  });
});
