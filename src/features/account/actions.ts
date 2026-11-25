'use server';
import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from '@/lib/zod';
import { defineUserAction } from '@/lib/actions/define';
import { ForbiddenError } from '@/lib/auth/errors';
import { logActivity } from '@/lib/audit/log';
import { publicEnv } from '@/lib/env/public';
import { createClient } from '@/lib/supabase/server';
import { UpdateNameInput } from '@/features/auth/schema';

export const updateOwnName = defineUserAction({
  input: UpdateNameInput,
  handler: async ({ fullName }, { access }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', access.userId);
    if (error) throw error;
    await logActivity(supabase, {
      action: 'account.name_changed',
      entityType: 'profile',
      entityId: access.userId,
      summary: 'Changed their display name',
      before: { full_name: access.fullName },
      after: { full_name: fullName },
    });
    revalidatePath('/admin', 'layout');
    return { fullName };
  },
});

/** Password changes go through an emailed link, which proves control of the mailbox. */
export const sendOwnPasswordReset = defineUserAction({
  input: z.object({}),
  handler: async (_input, { access }) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(access.email, {
      redirectTo: new URL(
        '/auth/confirm?next=/reset-password',
        publicEnv.NEXT_PUBLIC_SITE_URL,
      ).toString(),
    });
    if (error) throw error;
    await logActivity(supabase, {
      action: 'account.password_reset_requested',
      summary: 'Asked for a password reset link',
    });
    return { sent: true };
  },
});

/** Removing the authenticator is refused when the user's role requires MFA. */
export const removeAuthenticator = defineUserAction({
  input: z.object({ factorId: z.string().min(1).max(64) }),
  handler: async ({ factorId }, { access }) => {
    if (access.requiresMfa) throw new ForbiddenError();
    const supabase = await createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    await logActivity(supabase, {
      action: 'auth.mfa_removed',
      summary: 'Removed their authenticator app',
    });
    revalidatePath('/admin/account');
    return { removed: true };
  },
});
