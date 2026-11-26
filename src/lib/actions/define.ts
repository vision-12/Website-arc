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
  /**
   * The permission key, or a function of the parsed input that returns it. Use the function form
   * only when the rule depends on settings, e.g. publishing needs `approve` instead of `publish`
   * when the school's approval workflow is on (spec §2.3).
   */
  permission: string | ((input: z.infer<S>) => string | Promise<string>);
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
}): (raw: unknown) => Promise<Result<T>> {
  return async (raw: unknown) => {
    try {
      const input: z.infer<S> = config.input.parse(raw);
      const permission =
        typeof config.permission === 'function'
          ? await config.permission(input)
          : config.permission;
      const access = await requirePermission(permission);
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
