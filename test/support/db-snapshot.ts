/**
 * Database snapshot harness (plan P3-G): the row count and an md5 checksum of every table in the
 * given schemas, so a test can prove an operation changed nothing it shouldn't. Local stack only;
 * reused by Phase 5's template-switch test through the admin UI.
 */
import { Client } from 'pg';

export interface TableSnapshot {
  rows: number;
  checksum: string;
}
export type DbSnapshot = Record<string, TableSnapshot>;

const DEFAULT_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const quote = (ident: string) => `"${ident.replaceAll('"', '""')}"`;

export async function snapshotDatabase(
  options: { schemas?: string[]; tables?: string[] } = {},
): Promise<DbSnapshot> {
  const schemas = options.schemas ?? ['public', 'private'];
  const tables = options.tables ?? ['storage.objects', 'storage.buckets'];
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL ?? DEFAULT_URL });
  await client.connect();
  try {
    const { rows: list } = await client.query<{ schema: string; name: string }>(
      `select table_schema as schema, table_name as name
         from information_schema.tables
        where table_type = 'BASE TABLE'
          and (table_schema = any($1) or table_schema || '.' || table_name = any($2))
        order by 1, 2`,
      [schemas, tables],
    );
    const snapshot: DbSnapshot = {};
    for (const { schema, name } of list) {
      // Rows are ordered by their text form, so the checksum doesn't depend on physical order.
      const { rows } = await client.query<{ rows: string; checksum: string }>(
        `select count(*)::text as rows,
                md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as checksum
           from ${quote(schema)}.${quote(name)} t`,
      );
      const row = rows[0];
      if (!row) throw new Error(`No snapshot row for ${schema}.${name}`);
      snapshot[`${schema}.${name}`] = { rows: Number(row.rows), checksum: row.checksum };
    }
    return snapshot;
  } finally {
    await client.end();
  }
}

/** Tables whose count or checksum differs between two snapshots. */
export function changedTables(before: DbSnapshot, after: DbSnapshot): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names]
    .filter((n) => before[n]?.rows !== after[n]?.rows || before[n]?.checksum !== after[n]?.checksum)
    .sort();
}
