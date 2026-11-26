import * as OTPAuth from 'otpauth';
import {
  adminClient,
  createStaffUser,
  latestEmail,
  linkFrom,
  TEST_PASSWORD,
} from '../test/support/supabase';
import { loginAs, signIn, uniqueIp } from './auth-helpers';
import { expect, expectAxeClean, screenshot, test } from './fixtures';

const S = {
  overview: 'Overview',
  pages: 'Website pages',
  news: 'News & announcements',
  admissions: 'Admissions',
  academics: 'Academic programmes',
  events: 'Events calendar',
  gallery: 'Gallery',
  staff: 'Staff directory',
  resources: 'Resource centre',
  enquiries: 'Contact enquiries',
  media: 'Media library',
  appearance: 'Website appearance',
  users: 'Users & permissions',
  settings: 'Settings',
  activity: 'Activity log',
  trash: 'Trash',
};
const CONTENT_VIEWS = [S.pages, S.news, S.academics, S.events, S.gallery, S.staff, S.resources];

/**
 * Expected sidebar per role = sections whose view permission the role holds (spec §2.5), plus Trash
 * for roles that can delete something (spec §5.4).
 */
const SIDEBAR: Record<string, string[]> = {
  school_admin: Object.values(S),
  headteacher: [
    S.overview,
    S.pages,
    S.news,
    S.admissions,
    S.academics,
    S.events,
    S.gallery,
    S.staff,
    S.resources,
    S.enquiries,
    S.media,
    S.appearance,
    S.users,
    S.activity,
  ],
  content_editor: [S.overview, ...CONTENT_VIEWS, S.media, S.appearance, S.trash],
  events_manager: [S.overview, ...CONTENT_VIEWS, S.media, S.trash],
  read_only_staff: [S.overview, ...CONTENT_VIEWS, S.media, S.appearance],
  platform_support: [S.overview, ...CONTENT_VIEWS, S.media, S.appearance, S.settings, S.activity],
};
const ordered = (labels: string[]) => Object.values(S).filter((l) => labels.includes(l));

function totp(secret: string, offsetSteps = 0): string {
  const t = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '')),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return t.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

test.describe('sign-in', () => {
  test('signed-out visitors are sent to login, keeping their destination', async ({
    page,
    cspViolations,
  }, info) => {
    await uniqueIp(page);
    await page.goto('/admin/news?page=2');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fnews%3Fpage%3D2$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expectAxeClean(page);
    await screenshot(page, `login-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });

  test('a wrong password gets a generic message and keeps the email address', async ({
    page,
    cspViolations,
  }) => {
    const user = await createStaffUser('content_editor');
    await signIn(page, { email: user.email, password: 'not-the-password-1' });
    const message = page.locator('form [role=alert]');
    await expect(message).toHaveText('Email or password is incorrect.');
    await expect(message).toBeFocused();
    await expect(page.getByLabel('Email address')).toHaveValue(user.email);
    await expectAxeClean(page);
    expect(cspViolations).toEqual([]);
  });

  test('an unknown email gets exactly the same message (no account enumeration)', async ({
    page,
  }) => {
    await signIn(page, { email: 'nobody-here@e2e.test', password: 'whatever-password-1' });
    await expect(page.locator('form [role=alert]')).toHaveText('Email or password is incorrect.');
  });

  test('mistakes are caught in the browser, with the server schema, before anything is sent', async ({
    page,
    cspViolations,
  }) => {
    const actionPosts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action']) actionPosts.push(r.url());
    });
    await uniqueIp(page);
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeEnabled();
    await page.getByLabel('Email address').fill('not-an-email');
    await submit.click();

    await expect(page.locator('form [role=alert]')).toHaveText(
      'Please check the highlighted fields.',
    );
    const email = page.getByLabel('Email address');
    await expect(email).toHaveValue('not-an-email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription(
      'Enter a valid email address, like name@school.ac',
    );
    await expect(page.getByLabel('Password')).toHaveAccessibleDescription('Enter your password');
    expect(actionPosts).toEqual([]);
    await expectAxeClean(page);
    expect(cspViolations).toEqual([]);
  });

  test('invited-but-not-accepted and deactivated accounts cannot sign in', async ({ page }) => {
    for (const status of ['invited', 'deactivated'] as const) {
      const user = await createStaffUser('content_editor', { status });
      await signIn(page, user);
      await expect(page.locator('form [role=alert]')).toHaveText('Email or password is incorrect.');
    }
  });

  test('cannot be submitted before the page is ready, then works (no broken pre-hydration submit)', async ({
    page,
  }) => {
    const user = await createStaffUser('content_editor');
    await uniqueIp(page);
    let hold = true;
    // Hold back only scripts: CSS chunks share the path, and holding them delays parsing itself.
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      if (hold) await new Promise((r) => setTimeout(r, 8000));
      await route.continue();
    });
    await page.goto('/login?next=/admin/overview', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    const button = page.getByRole('button', { name: 'Sign in' });
    await expect(button).toBeDisabled();
    hold = false;
    await expect(button).toBeEnabled({ timeout: 15_000 });
    await button.click();
    await page.waitForURL('**/admin/overview');
  });

  test('signing out returns to the login page', async ({ page }) => {
    await loginAs(page, 'content_editor');
    await page.getByRole('button', { name: /Your account/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=1/);
    await expect(page.getByRole('status')).toHaveText('You have signed out.');
    await page.goto('/admin/overview');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('role-based administration (PRD §6.2, §7)', () => {
  for (const [role, expected] of Object.entries(SIDEBAR)) {
    test(`${role} sees exactly the sections their role permits`, async ({
      page,
      cspViolations,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'sidebar list is checked once, at desktop width');
      await loginAs(page, role);
      const nav = page.getByRole('navigation', { name: 'Administration sections' });
      await expect(nav.getByRole('link')).toHaveText(ordered(expected));
      expect(cspViolations).toEqual([]);
    });
  }

  test('a section outside the role is refused even by direct URL', async ({ page }) => {
    await loginAs(page, 'events_manager');
    await page.goto('/admin/users');
    await expect(
      page.getByRole('heading', { name: "You don't have access to this section" }),
    ).toBeVisible();
    await expect(page.getByText('Users & permissions')).toHaveCount(0);
  });

  test('deactivating an account signs the person out on their next page load', async ({ page }) => {
    const user = await loginAs(page, 'content_editor');
    await adminClient().from('profiles').update({ status: 'deactivated' }).eq('id', user.id);
    await page.goto('/admin/news');
    await expect(page).toHaveURL(/\/login\?error=inactive/);
    await expect(page.getByRole('status')).toContainText('Your account is not active');
  });
});

test.describe('two-step sign-in (MFA)', () => {
  test('an admissions officer must set up an authenticator, then is challenged on every sign-in', async ({
    page,
    cspViolations,
  }, info) => {
    const user = await createStaffUser('admissions_officer');
    await signIn(page, user);
    await page.waitForURL(/\/mfa\/setup/);
    const secret = (await page.getByTestId('totp-secret').textContent()) ?? '';
    expect(secret.length).toBeGreaterThan(10);
    await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
    await expectAxeClean(page);
    await screenshot(page, `mfa-setup-${info.project.name}`);

    await page.getByLabel('6-digit code').fill('000000');
    await page.getByRole('button', { name: 'Turn on two-step sign-in' }).click();
    await expect(page.locator('form [role=alert]')).toContainText("That code didn't work");

    await page.getByLabel('6-digit code').fill(totp(secret));
    await page.getByRole('button', { name: 'Turn on two-step sign-in' }).click();
    await page.waitForURL('**/admin/overview');
    await page.goto('/admin/admissions');
    await expect(page.getByRole('heading', { level: 1, name: 'Admissions' })).toBeVisible();

    // Sign out and back in: the code is now required.
    await page.getByRole('button', { name: /Your account/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await signIn(page, user);
    await page.waitForURL(/\/mfa\?/);
    await expectAxeClean(page);
    await page.getByLabel('6-digit code').fill(totp(secret, 1));
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL('**/admin/overview');
    expect(cspViolations).toEqual([]);
  });

  test('a role that does not require MFA can turn it on from the account page', async ({
    page,
  }) => {
    await loginAs(page, 'content_editor');
    await page.goto('/admin/account');
    await expect(page.getByText('Off — you sign in with your password only.')).toBeVisible();
    await page.getByRole('link', { name: 'Set up an authenticator app' }).click();
    await page.waitForURL(/\/mfa\/setup/);
    const secret = (await page.getByTestId('totp-secret').textContent()) ?? '';
    await page.getByLabel('6-digit code').fill(totp(secret));
    await page.getByRole('button', { name: 'Turn on two-step sign-in' }).click();
    await page.waitForURL('**/admin/account');
    await expect(page.getByText(/^On — /)).toBeVisible();
  });
});

test.describe('emailed links', () => {
  test('password reset by email works and the old password stops working', async ({
    page,
    cspViolations,
  }) => {
    const user = await createStaffUser('content_editor');
    await uniqueIp(page);
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.locator('form [role=status]')).toContainText('If an account exists');
    await expectAxeClean(page);

    const mail = await latestEmail(user.email);
    expect(mail?.subject).toBe('Reset your password');
    await page.goto(linkFrom(mail!.html));
    await page.waitForURL(/\/reset-password/);
    const newPassword = 'Lake Victoria sunrise 2027';
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Type the new password again').fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await page.waitForURL('**/admin/overview');

    await page.context().clearCookies();
    await signIn(page, { email: user.email, password: TEST_PASSWORD });
    await expect(page.locator('form [role=alert]')).toHaveText('Email or password is incorrect.');
    await signIn(page, { email: user.email, password: newPassword });
    await page.waitForURL('**/admin/overview');
    expect(cspViolations).toEqual([]);
  });

  test('an invited member of staff sets their name and password and lands in the admin area', async ({
    page,
    cspViolations,
  }, info) => {
    const admin = adminClient();
    const email = `invite-${Date.now()}-${info.project.name}@e2e.test`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: 'Grace Nakato' },
    });
    expect(error).toBeNull();
    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'content_editor')
      .single();
    await admin.from('user_roles').insert({ user_id: data.user!.id, role_id: role!.id });

    const mail = await latestEmail(email);
    await uniqueIp(page);
    await page.goto(linkFrom(mail!.html));
    await page.waitForURL(/\/accept-invite/);
    await expect(page.getByLabel('Your full name')).toHaveValue('Grace Nakato');
    await expectAxeClean(page);
    await screenshot(page, `accept-invite-${info.project.name}`);
    await page.getByLabel('Choose a password').fill('Ssese islands 2027 ok');
    await page.getByLabel('Type the password again').fill('Ssese islands 2027 ok');
    await page.getByRole('button', { name: 'Set up my account' }).click();
    await page.waitForURL('**/admin/overview');
    await expect(page.getByText('Welcome, Grace.')).toBeVisible();

    // The link is single-use.
    await page.context().clearCookies();
    await page.goto(linkFrom(mail!.html));
    await expect(page).toHaveURL(/\/login\?error=link/);
    expect(cspViolations).toEqual([]);
  });
});

test.describe('account page', () => {
  test('staff can change their display name', async ({ page, cspViolations }, info) => {
    await loginAs(page, 'read_only_staff', '/admin/account');
    await expectAxeClean(page);
    await screenshot(page, `account-${info.project.name}`);
    await page.getByLabel('Your name').fill('Ruth Namubiru');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByText('Your name has been updated'),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Ruth Namubiru');
    expect(cspViolations).toEqual([]);
  });
});
