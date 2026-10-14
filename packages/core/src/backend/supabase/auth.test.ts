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
    assert.equal(options.emailRedirectTo, 'https://onyx.test/auth/callback?next=%2Fpro%2Fonboarding');
  });

  it('tells unconfirmed accounts to open their confirmation email', async () => {
    const { client } = fakeSupabase({ signIn: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } });
    await rejectsWith(createSupabaseBackend(client).auth.signIn({ email: 'awa@example.com', password: 'whatever' }), 'email_not_confirmed');
  });

  it('deletes an account in a safe order: check, documents, account, then this device', async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
        signOut: async (options?: { scope?: string }) => {
          calls.push(`signOut:${options?.scope}`);
          return { error: null };
        },
      },
      rpc: async (name: string, args?: { p_dry_run?: boolean }) => {
        calls.push(`${name}:${args?.p_dry_run ? 'check' : 'delete'}`);
        return { data: null, error: null };
      },
      storage: {
        from: () => ({
          list: async (folder: string) => {
            calls.push(`list:${folder}`);
            return { data: [{ name: 'id_card-1.jpg' }], error: null };
          },
          remove: async (paths: string[]) => {
            calls.push(`remove:${paths.join(',')}`);
            return { data: [], error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    await createSupabaseBackend(client).auth.deleteAccount();
    assert.deepEqual(calls, ['delete_my_account:check', 'list:user-1', 'remove:user-1/id_card-1.jpg', 'delete_my_account:delete', 'signOut:local']);
  });

  it('removes nothing while a job is still open', async () => {
    const calls: string[] = [];
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
      rpc: async () => ({ data: null, error: { message: 'ONYX:conflict' } }),
      storage: {
        from: () => ({
          list: async () => {
            calls.push('list');
            return { data: [], error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    await rejectsWith(createSupabaseBackend(client).auth.deleteAccount(), 'conflict');
    assert.deepEqual(calls, []);
  });

  it('sends Google sign-ins back to the public address, letting people pick their account', async () => {
    let sent: unknown;
    const client = {
      auth: {
        signInWithOAuth: async (args: unknown) => {
          sent = args;
          return { data: { provider: 'google', url: 'https://accounts.google.com/…' }, error: null };
        },
      },
    } as unknown as SupabaseClient;
    await createSupabaseBackend(client, { siteUrl: 'https://onyx.test' }).auth.signInWithProvider('google', { redirectPath: '/pro/onboarding' });
    assert.deepEqual(sent, {
      provider: 'google',
      options: { redirectTo: 'https://onyx.test/auth/callback?next=%2Fpro%2Fonboarding', queryParams: { prompt: 'select_account' } },
    });
  });

  it('checks the emailed sign-up code, then signs the person in', async () => {
    let checked: unknown;
    const profile = { id: 'user-9', role: 'driver', full_name: 'Awa Ngo', email: 'awa@example.com', phone: null, locale: 'fr', default_vehicle: null, created_at: '2026-10-15T08:00:00.000Z' };
    const client = {
      auth: {
        verifyOtp: async (args: unknown) => {
          checked = args;
          return { data: { user: { id: 'user-9', email: 'awa@example.com' }, session: {} }, error: null };
        },
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
    } as unknown as SupabaseClient;
    const session = await createSupabaseBackend(client).auth.verifySignUpCode('awa@example.com', ' 123456 ');
    assert.deepEqual(checked, { email: 'awa@example.com', token: '123456', type: 'email' });
    assert.equal(session.profile.fullName, 'Awa Ngo');
  });

  it('turns a wrong or expired code into a message on the code field', async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        verifyOtp: async () => {
          calls.push('verify');
          return { data: { user: null, session: null }, error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' } };
        },
      },
    } as unknown as SupabaseClient;
    const backend = createSupabaseBackend(client);
    await rejectsWith(backend.auth.verifySignUpCode('awa@example.com', '12ab'), 'validation', ['code', 'invalid_code']);
    assert.deepEqual(calls, [], 'a code that is not digits never reaches Supabase');
    await rejectsWith(backend.auth.verifySignUpCode('awa@example.com', '654321'), 'validation', ['code', 'invalid_code']);
  });

  it('still recognises wrong passwords from older Auth servers', async () => {
    const { client } = fakeSupabase({ signIn: { status: 400, message: 'Invalid login credentials' } });
    await rejectsWith(createSupabaseBackend(client).auth.signIn({ email: 'awa@example.com', password: 'whatever' }), 'invalid_credentials');
  });
});
