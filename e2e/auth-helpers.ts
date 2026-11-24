import { randomInt } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createStaffUser, type TestUser } from '../test/support/supabase';

/** A fresh client IP per test so the per-IP login limit (shared localhost) never interferes. */
export async function uniqueIp(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
}

export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
  next = '/admin/overview',
) {
  await uniqueIp(page);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Creates a user with the role and signs in; waits for the admin shell. */
export async function loginAs(
  page: Page,
  roleKey: string,
  next = '/admin/overview',
): Promise<TestUser> {
  const user = await createStaffUser(roleKey);
  await signIn(page, user, next);
  await page.waitForURL(`**${next}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  return user;
}
