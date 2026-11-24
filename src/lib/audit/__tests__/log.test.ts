import { describe, expect, it, vi } from 'vitest';
import type { TypedClient } from '@/lib/supabase/server';
import { logActivity } from '../log';
import { REDACTED } from '../redact';

const client = (error: unknown = null) => {
  const rpc = vi.fn().mockResolvedValue({ data: 1, error });
  return { rpc, supabase: { rpc } as unknown as TypedClient };
};

describe('logActivity', () => {
  it('sends a redacted diff and omits absent optional fields', async () => {
    const { rpc, supabase } = client();
    await logActivity(supabase, {
      action: 'account.name_changed',
      summary: 'Renamed',
      before: { full_name: 'A', email: 'a@x.test' },
      after: { full_name: 'B' },
    });
    expect(rpc).toHaveBeenCalledWith('log_activity', {
      p_action: 'account.name_changed',
      p_summary: 'Renamed',
      p_diff: { before: { full_name: 'A', email: REDACTED }, after: { full_name: 'B' } },
    });
  });

  it('passes entity, metadata and IP hash when given', async () => {
    const { rpc, supabase } = client();
    await logActivity(supabase, {
      action: 'x.y',
      summary: 's',
      entityType: 'page',
      entityId: '1',
      metadata: { rowCount: 3, phone: '+2567' },
      ipHash: 'h',
    });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_entity_type: 'page',
      p_entity_id: '1',
      p_metadata: { rowCount: 3, phone: REDACTED },
      p_ip_hash: 'h',
    });
  });

  it('throws when the database refuses', async () => {
    const { supabase } = client({ code: '42501', message: 'UNAUTHENTICATED' });
    await expect(logActivity(supabase, { action: 'x.y', summary: 's' })).rejects.toMatchObject({
      code: '42501',
    });
  });
});
