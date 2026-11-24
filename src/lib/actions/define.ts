import 'server-only';
import type { z } from 'zod';
import { requirePermission, requireUser, type Access } from '@/lib/auth/access';
import { toActionError } from './errors';
import { ok, type Result } from './result';

export interface ActionContext {
  access: Access;
}

/**
 * The mutation pipeline every Server Action follows (MP §4.2, CLAUDE.md):
 * Zod parse → requirePermission → handler (DB write with the user-scoped client, audit, tag
 * revalidation) → typed Result. Errors are mapped to plain-language codes; nothing raw leaks.
 */
export function defineAction<S extends z.ZodType, T>(config: {
  input: S;
  permission: string;
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
}): (raw: unknown) => Promise<Result<T>> {
  return async (raw: unknown) => {
    try {
      const input: z.infer<S> = config.input.parse(raw);
      const access = await requirePermission(config.permission);
      return ok(await config.handler(input, { access }));
    } catch (error) {
      return { ok: false, error: toActionError(error) };
    }
  };
}

/** For actions on the caller's own account: requires a signed-in, active user (no permission key). */
export function defineUserAction<S extends z.ZodType, T>(config: {
  input: S;
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
}): (raw: unknown) => Promise<Result<T>> {
  return async (raw: unknown) => {
    try {
      const input: z.infer<S> = config.input.parse(raw);
      const access = await requireUser();
      return ok(await config.handler(input, { access }));
    } catch (error) {
      return { ok: false, error: toActionError(error) };
    }
  };
}
