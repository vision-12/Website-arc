import type { Json } from '@/types/database';

/**
 * A validated, JSON-safe value (a Zod-checked document or settings object) as the database's
 * non-null `jsonb` type. The caller vouches for the shape; this only bridges the static types.
 */
export function asJson(value: object): NonNullable<Json> {
  return value as unknown as NonNullable<Json>;
}
