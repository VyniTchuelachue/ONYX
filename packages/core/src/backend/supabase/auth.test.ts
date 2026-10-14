import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBackend } from './index';
import { isBackendError } from '../errors';

type AuthError = { code?: string; status?: number; message: string } | null;

/** Just enough of supabase-js auth to check what the adapter sends and how it reads errors. */
function fakeSupabase(errors: { reset?: AuthError; update?: AuthError; signIn?: AuthError } = {}) {
  const calls: Record<string, unknown[]> = {};
  const auth = {
    async getSession() {
      return { data: { session: { user: { id: 'user-1' }, access_token: 'token' } } };
    },
    async resetPasswordForEmail(...args: unknown[]) {
      calls.reset = args;
      return { data: {}, error: errors.reset ?? null };
    },
    async updateUser(...args: unknown[]) {
      calls.update = args;
      return { data: {}, error: errors.update ?? null };
    },
    async signUp(...args: unknown[]) {
      calls.signUp = args;
      return { data: { user: { id: 'user-2', identities: [{}] }, session: null }, error: null };
    },
    async signInWithPassword(...args: unknown[]) {
      calls.signIn = args;
      return { data: { user: null, session: null }, error: errors.signIn ?? null };
    },
  };
  return { client: { auth } as unknown as SupabaseClient, calls };
}

async function rejectsWith(promise: Promise<unknown>, code: string, field?: [string, string]) {
  await assert.rejects(promise, (e: unknown) => {
    if (!isBackendError(e) || e.code !== code) return false;
    return field ? e.fields?.[field[0]] === field[1] : true;
  });
}

describe('supabase adapter: accounts', () => {
  it('sends reset links back to the reset page', async () => {
    const { client, calls } = fakeSupabase();
    await createSupabaseBackend(client, { siteUrl: 'https://onyx.test' }).auth.requestPasswordReset(' Awa@Example.com ');
    assert.deepEqual(calls.reset, ['Awa@Example.com', { redirectTo: 'https://onyx.test/auth/reset-password' }]);
  });

  it('checks the address before calling Supabase', async () => {
    const { client, calls } = fakeSupabase();
    await rejectsWith(createSupabaseBackend(client).auth.requestPasswordReset('not-an-email'), 'validation', ['email', 'invalid_email']);
    assert.equal(calls.reset, undefined);
  });

  it('reports email rate limits as rate_limited', async () => {
    const { client } = fakeSupabase({ reset: { code: 'over_email_send_rate_limit', status: 429, message: 'For security purposes…' } });
    await rejectsWith(createSupabaseBackend(client).auth.requestPasswordReset('awa@example.com'), 'rate_limited');
  });

  it('turns password rules from Supabase into field errors', async () => {
    const same = fakeSupabase({ update: { code: 'same_password', status: 422, message: 'New password should be different' } });
    await rejectsWith(createSupabaseBackend(same.client).auth.updatePassword('another-pass'), 'validation', ['password', 'same_password']);
    const weak = fakeSupabase({ update: { code: 'weak_password', status: 422, message: 'Password is known to be weak' } });
    await rejectsWith(createSupabaseBackend(weak.client).auth.updatePassword('password1'), 'validation', ['password', 'weak_password']);
    await rejectsWith(createSupabaseBackend(same.client).auth.updatePassword('short'), 'validation', ['password', 'password_too_short']);
  });

  it('brings technicians back to onboarding after they confirm their email', async () => {
    const { client, calls } = fakeSupabase();
    const result = await createSupabaseBackend(client, { siteUrl: 'https://onyx.test' }).auth.signUp(
      { email: 'jp@example.com', password: 'long-enough', fullName: 'Jean-Paul', intent: 'technician', locale: 'fr' },
      { redirectPath: '/pro/onboarding' },
    );
    assert.equal(result.needsEmailConfirmation, true);
    const options = (calls.signUp?.[0] as { options: { emailRedirectTo: string } }).options;
    assert.equal(options.emailRedirectTo, 'https://onyx.test/auth/sign-in?next=%2Fpro%2Fonboarding');
  });

  it('tells unconfirmed accounts to open their confirmation email', async () => {
    const { client } = fakeSupabase({ signIn: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } });
    await rejectsWith(createSupabaseBackend(client).auth.signIn({ email: 'awa@example.com', password: 'whatever' }), 'email_not_confirmed');
  });

  it('still recognises wrong passwords from older Auth servers', async () => {
    const { client } = fakeSupabase({ signIn: { status: 400, message: 'Invalid login credentials' } });
    await rejectsWith(createSupabaseBackend(client).auth.signIn({ email: 'awa@example.com', password: 'whatever' }), 'invalid_credentials');
  });
});
