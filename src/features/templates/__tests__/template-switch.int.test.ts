import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Theme, type SiteSettings } from '@/features/cms/settings/schema';
import { adminClient, createStaffUser, signedInClient } from '../../../../test/support/supabase';
import { changedTables, snapshotDatabase } from '../../../../test/support/db-snapshot';

/**
 * MP §12 Definition of Done for Phase 3: switching templates changes nothing in the database
 * except the template itself (plan P3-G). A School Administrator switches through all four
 * templates with update_site_settings, the same database function Phase 5's action will call,
 * and back. Every other table keeps its row count and checksum; every switch is audited.
 */
describe('switching templates', () => {
  it('changes only theme.template, and records each switch in the activity log', async () => {
    const admin = adminClient();
    const read = async () => {
      const { data, error } = await admin
        .from('site_settings')
        .select('data, version')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return { data: data.data as SiteSettings, version: data.version };
    };
    const logCount = async () => {
      const { count, error } = await admin
        .from('activity_logs')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    };

    const user = await createStaffUser('school_admin');
    const asAdmin = await signedInClient(user);
    const original = await read();
    const start = original.data.theme.template;
    const others = Theme.shape.template.options.filter((k) => k !== start);
    const route = [...others, start];

    const before = await snapshotDatabase();
    const logsBefore = await logCount();
    let version = original.version;
    const evidence: { template: string; changedTables: string[] }[] = [];

    for (const template of route) {
      const { data, error } = await asAdmin.rpc('update_site_settings', {
        p_section: 'theme',
        p_value: { ...original.data.theme, template },
        p_version: version,
      });
      expect(error).toBeNull();
      version = data!;

      const now = await read();
      expect(now.data).toEqual({
        ...original.data,
        theme: { ...original.data.theme, template },
      });
      const changed = changedTables(before, await snapshotDatabase());
      expect(changed).toEqual(['public.activity_logs', 'public.site_settings']);
      evidence.push({ template, changedTables: changed });
    }

    // Back on the original template: the settings document is exactly what it was.
    const after = await read();
    expect(after.data).toEqual(original.data);
    expect(after.version).toBe(original.version + route.length);

    // One settings.updated entry per switch, by this user.
    expect(await logCount()).toBe(logsBefore + route.length);
    const { data: logs } = await admin
      .from('activity_logs')
      .select('action, actor_id')
      .order('occurred_at', { ascending: false })
      .limit(route.length);
    expect(logs).toEqual(route.map(() => ({ action: 'settings.updated', actor_id: user.id })));

    if (process.env.WRITE_EVIDENCE) {
      const final = await snapshotDatabase();
      mkdirSync('docs/plan/evidence/phase-03', { recursive: true });
      writeFileSync(
        'docs/plan/evidence/phase-03/template-switch-checksums.json',
        `${JSON.stringify(
          {
            test: 'src/features/templates/__tests__/template-switch.int.test.ts',
            route: [start, ...route],
            changedAfterEachSwitch: evidence,
            tablesCompared: Object.keys(before).length,
            unchanged: Object.keys(before).filter(
              (t) => !['public.activity_logs', 'public.site_settings'].includes(t),
            ).length,
            before,
            after: final,
          },
          null,
          2,
        )}\n`,
      );
    }
  });
});
