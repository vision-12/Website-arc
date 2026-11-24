import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from './errors';

const AccessSchema = z.object({
  userId: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  status: z.enum(['invited', 'active', 'deactivated']),
  mfaEnrolled: z.boolean(),
  requiresMfa: z.boolean(),
  isPlatformSupport: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  sensitivePermissions: z.array(z.string()),
});

export interface Access extends Omit<
  z.infer<typeof AccessSchema>,
  'permissions' | 'sensitivePermissions'
> {
  aal: 'aal1' | 'aal2';
  permissions: ReadonlySet<string>;
  sensitivePermissions: ReadonlySet<string>;
  /** MFA is required for this user but the current session has not completed it. */
  needsMfaStep: boolean;
}

/**
 * The signed-in user's verified identity and permissions, once per request (React cache).
 * Identity comes from getClaims() (JWT verified, MP §2.4); permissions from my_access(), which
 * evaluates the same SQL rule RLS uses. Returns null when signed out.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  if (error || !claimsData?.claims.sub) return null;

  const { data, error: rpcError } = await supabase.rpc('my_access');
  if (rpcError) throw rpcError;
  const parsed = AccessSchema.safeParse(data);
  if (!parsed.success) return null;

  const aal = claimsData.claims.aal === 'aal2' ? 'aal2' : 'aal1';
  const { permissions, sensitivePermissions, ...rest } = parsed.data;
  return {
    ...rest,
    aal,
    permissions: new Set(permissions),
    sensitivePermissions: new Set(sensitivePermissions),
    needsMfaStep: rest.requiresMfa && aal !== 'aal2',
  };
});

/** Signed-in, active user or throws. */
export async function requireUser(): Promise<Access> {
  const access = await getAccess();
  if (!access || access.status !== 'active') throw new UnauthenticatedError();
  return access;
}

/**
 * The server-side authority for every Server Action and admin page (MP §6). The UI may hide
 * things, but only this (and RLS behind it) decides.
 */
export async function requirePermission(permission: string): Promise<Access> {
  const access = await requireUser();
  if (!access.permissions.has(permission)) throw new ForbiddenError(permission);
  if (access.needsMfaStep && access.sensitivePermissions.has(permission))
    throw new MfaRequiredError();
  if (access.isPlatformSupport && access.sensitivePermissions.has(permission)) {
    // Every use of a time-boxed support grant is audited (MP §6, PRD §3.4).
    const supabase = await createClient();
    await supabase.rpc('log_activity', {
      p_action: 'support.access',
      p_summary: `Altrastate support used ${permission}`,
      p_entity_type: 'permission',
      p_entity_id: permission,
    });
  }
  return access;
}

export function can(access: Access | null, permission: string): boolean {
  return !!access && access.status === 'active' && access.permissions.has(permission);
}
