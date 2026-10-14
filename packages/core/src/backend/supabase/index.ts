import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { placeLabelFor } from '../../domain/geo';
import {
  completeInputSchema,
  createRequestSchema,
  fieldErrors,
  newPasswordSchema,
  passwordResetSchema,
  profilePatchSchema,
  pushDeviceSchema,
  quoteInputSchema,
  reviewInputSchema,
  signInSchema,
  signUpCodeSchema,
  signUpSchema,
  technicianInputSchema,
} from '../../schemas';
import type { AdminMetrics, ProStats, TechnicianPrivate } from '../../types';
import { BackendError, toBackendError } from '../errors';
import type { OnyxBackend, Session } from '../types';
import {
  REQUEST_DETAIL_SELECT,
  REQUEST_LIST_SELECT,
  REVIEW_COLUMNS,
  TECH_COLUMNS,
  mapDetailRow,
  mapDocument,
  mapInboxItem,
  mapPayment,
  mapPerformance,
  mapProfile,
  mapRequest,
  mapRequestListItem,
  mapReview,
  mapTechnician,
  mapTechnicianPrivate,
  mapTechnicianWithDistance,
} from './mappers';
import type { ZodType } from 'zod';

export * from './mappers';

const DOCUMENT_BUCKET = 'technician-documents';

export interface SupabaseBackendOptions {
  /** How often the technician inbox is re-checked (requests not yet assigned are not pushed). Default 12 s. */
  inboxPollMs?: number;
  /** The app's origin (e.g. https://onyx.cm), so links in auth emails lead back to it. */
  siteUrl?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result<T> = { data: T | null; error: any };

async function run<T>(promise: PromiseLike<Result<T>>): Promise<T> {
  let res: Result<T>;
  try {
    res = await promise;
  } catch (e) {
    throw toBackendError(e);
  }
  if (res.error) throw toBackendError(res.error);
  return res.data as T;
}

/** Supabase Auth errors carry a stable `code`; map the ones a person can act on. */
function authError(error: { code?: string; status?: number; message: string }): BackendError {
  switch (error.code) {
    case 'invalid_credentials':
      return new BackendError('invalid_credentials', error.message);
    case 'email_not_confirmed':
      return new BackendError('email_not_confirmed', error.message);
    case 'user_already_exists':
    case 'email_exists':
      return new BackendError('email_taken', error.message);
    case 'same_password':
      return new BackendError('validation', error.message, { password: 'same_password' });
    case 'weak_password':
      return new BackendError('validation', error.message, { password: 'weak_password' });
    case 'otp_expired':
      return new BackendError('validation', error.message, { code: 'invalid_code' });
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new BackendError('rate_limited', error.message);
  }
  // Older Auth servers only describe the problem in the message.
  if (/invalid login credentials/i.test(error.message)) return new BackendError('invalid_credentials', error.message);
  if (/already registered|already exists/i.test(error.message)) return new BackendError('email_taken', error.message);
  if (error.status === 429) return new BackendError('rate_limited', error.message);
  return toBackendError(error);
}

function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BackendError('validation', 'Invalid input', fieldErrors(result.error));
  return result.data;
}

/**
 * Production backend: Postgres (RLS + RPC functions), Auth, Realtime and Storage on Supabase.
 * Works with any supabase-js client — the browser one here, an AsyncStorage-backed one on React Native.
 */
export function createSupabaseBackend(sb: SupabaseClient, opts: SupabaseBackendOptions = {}): OnyxBackend {
  const channels = new Set<RealtimeChannel>();
  // Supabase only follows these links if the site is on the project's redirect allow-list.
  const authLink = (path: string, next?: string) =>
    opts.siteUrl ? `${opts.siteUrl}${path}${next ? `?next=${encodeURIComponent(next)}` : ''}` : undefined;

  const currentUserId = async (): Promise<string | null> => {
    const { data } = await sb.auth.getSession();
    return data.session?.user.id ?? null;
  };

  const requireUserId = async (): Promise<string> => {
    const id = await currentUserId();
    if (!id) throw new BackendError('unauthenticated');
    return id;
  };

  const loadSession = async (user: { id: string; email?: string | null } | null | undefined): Promise<Session | null> => {
    if (!user) return null;
    const row = await run<any>(sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
    if (!row) return null;
    return { userId: user.id, email: user.email ?? null, profile: mapProfile(row) };
  };

  let myTechId: { userId: string; id: string | null } | null = null;
  const myTechnicianId = async (): Promise<string> => {
    const uid = await requireUserId();
    if (myTechId?.userId !== uid) {
      const rows = await run<any[]>(sb.rpc('get_my_technician'));
      myTechId = { userId: uid, id: rows?.[0]?.id ?? null };
    }
    if (!myTechId.id) throw new BackendError('forbidden', 'No technician listing');
    return myTechId.id;
  };

  const watchRequest = (id: string, onChange: () => void) => {
    const channel = sb
      .channel(`request:${id}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `request_id=eq.${id}` }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_events', filter: `request_id=eq.${id}` }, onChange)
      .subscribe();
    channels.add(channel);
    return () => {
      channels.delete(channel);
      void sb.removeChannel(channel);
    };
  };

  const getDetail = async (id: string) => {
    const row = await run<any>(
      sb
        .from('service_requests')
        .select(REQUEST_DETAIL_SELECT)
        .eq('id', id)
        .maybeSingle(),
    );
    return row ? mapDetailRow(row) : null;
  };

  const signedUrls = async (paths: string[]): Promise<Map<string, string>> => {
    if (!paths.length) return new Map();
    const { data } = await sb.storage.from(DOCUMENT_BUCKET).createSignedUrls(paths, 3600);
    const urls = new Map<string, string>();
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
    return urls;
  };

  return {
    mode: 'supabase',
    dispose() {
      for (const c of channels) void sb.removeChannel(c);
      channels.clear();
    },

    auth: {
      async getSession() {
        const { data } = await sb.auth.getSession();
        return loadSession(data.session?.user);
      },
      onChange(listener) {
        const { data } = sb.auth.onAuthStateChange((event, session) => {
          if (event === 'TOKEN_REFRESHED') return;
          myTechId = null;
          // Supabase advises against awaiting other calls inside this callback.
          setTimeout(() => {
            void loadSession(session?.user).then(listener, () => listener(null));
          }, 0);
        });
        return () => data.subscription.unsubscribe();
      },
      async signIn(input) {
        const { email, password } = validate(signInSchema, input);
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw authError(error);
        const session = await loadSession(data.user);
        if (!session) throw new BackendError('not_found', 'Profile missing');
        return session;
      },
      async signInWithProvider(provider, options) {
        const { error } = await sb.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: authLink('/auth/callback', options?.redirectPath),
            // Shared phones are common: always let people pick the right Google account.
            queryParams: { prompt: 'select_account' },
          },
        });
        if (error) throw authError(error);
      },
      async signUp(input, options) {
        const d = validate(signUpSchema, input);
        const { data, error } = await sb.auth.signUp({
          email: d.email,
          password: d.password,
          options: {
            emailRedirectTo: authLink('/auth/callback', options?.redirectPath),
            data: { full_name: d.fullName, phone: d.phone ?? null, locale: d.locale, intent: d.intent },
          },
        });
        if (error) throw authError(error);
        // With confirmations on, an existing email returns a user with no identities.
        if (data.user && data.user.identities?.length === 0) throw new BackendError('email_taken');
        const session = data.session ? await loadSession(data.user) : null;
        return { session, needsEmailConfirmation: !data.session };
      },
      async verifySignUpCode(email, code) {
        const d = validate(signUpCodeSchema, { email, code });
        const { data, error } = await sb.auth.verifyOtp({ email: d.email, token: d.code, type: 'email' });
        if (error) throw authError(error);
        const session = await loadSession(data.user);
        if (!session) throw new BackendError('not_found', 'Profile missing');
        return session;
      },
      async resendSignUpCode(email) {
        const d = validate(passwordResetSchema, { email });
        const { error } = await sb.auth.resend({ type: 'signup', email: d.email, options: { emailRedirectTo: authLink('/auth/callback') } });
        if (error) throw authError(error);
      },
      async requestPasswordReset(email) {
        const d = validate(passwordResetSchema, { email });
        const { error } = await sb.auth.resetPasswordForEmail(d.email, { redirectTo: authLink('/auth/reset-password') });
        if (error) throw authError(error);
      },
      async updatePassword(password) {
        const d = validate(newPasswordSchema, { password });
        await requireUserId();
        const { error } = await sb.auth.updateUser({ password: d.password });
        if (error) throw authError(error);
      },
      async deleteAccount() {
        const uid = await requireUserId();
        // Check first: the verification documents can't come back once removed.
        await run(sb.rpc('delete_my_account', { p_dry_run: true }));
        // SQL can't remove Storage files, so empty the person's folder through the API.
        const folder = sb.storage.from(DOCUMENT_BUCKET);
        const { data: files, error: listError } = await folder.list(uid, { limit: 100 });
        if (listError) throw toBackendError(listError);
        if (files?.length) {
          const { error } = await folder.remove(files.map((f) => `${uid}/${f.name}`));
          if (error) throw toBackendError(error);
        }
        await run(sb.rpc('delete_my_account'));
        myTechId = null;
        // The account no longer exists on the server: only this device's session is left to clear.
        await sb.auth.signOut({ scope: 'local' });
      },
      async signOut() {
        myTechId = null;
        await sb.auth.signOut();
      },
      async updateProfile(patch) {
        const uid = await requireUserId();
        const d = validate(profilePatchSchema, patch);
        const update: Record<string, unknown> = {};
        if (d.fullName !== undefined) update.full_name = d.fullName;
        if (d.phone !== undefined) update.phone = d.phone;
        if (d.locale !== undefined) update.locale = d.locale;
        if (d.defaultVehicle !== undefined) update.default_vehicle = d.defaultVehicle;
        const row = await run<any>(sb.from('profiles').update(update).eq('id', uid).select('*').single());
        return mapProfile(row);
      },
      async getAccessToken() {
        const { data } = await sb.auth.getSession();
        return data.session?.access_token ?? null;
      },
    },

    directory: {
      async nearby(q) {
        const rows = await run<any[]>(
          sb.rpc('nearby_technicians', {
            p_lat: q.center.lat,
            p_lng: q.center.lng,
            p_radius_km: q.radiusKm,
            p_specialty: q.specialty ?? null,
            p_available_only: q.availableOnly ?? false,
            p_corridor: q.corridor ?? null,
            p_limit: q.limit ?? 60,
          }),
        );
        return (rows ?? []).map(mapTechnicianWithDistance);
      },
      async get(id) {
        const row = await run<any>(sb.from('technicians').select(TECH_COLUMNS).eq('id', id).maybeSingle());
        return row ? mapTechnician(row) : null;
      },
      async reviews(technicianId, limit = 20) {
        const rows = await run<any[]>(
          sb.from('reviews').select(REVIEW_COLUMNS).eq('technician_id', technicianId).order('created_at', { ascending: false }).limit(limit),
        );
        return (rows ?? []).map(mapReview);
      },
      async snapshot(center, radiusKm) {
        const rows = await run<any[]>(
          sb.rpc('nearby_technicians', { p_lat: center.lat, p_lng: center.lng, p_radius_km: radiusKm, p_limit: 200 }),
        );
        return (rows ?? []).map(mapTechnician);
      },
    },

    requests: {
      async create(input) {
        await requireUserId();
        const d = validate(createRequestSchema, input);
        const row = await run<any>(
          sb
            .rpc('create_service_request', {
              p_category: d.category,
              p_description: d.description,
              p_urgency: d.urgency,
              p_ai_summary: d.aiSummary ?? null,
              p_vehicle: d.vehicle,
              p_lat: d.location.lat,
              p_lng: d.location.lng,
              p_landmark: d.landmark,
              p_place_label: input.placeLabel ?? placeLabelFor(d.location),
              p_contact_name: d.contactName,
              p_contact_phone: d.contactPhone,
              p_requested_technician_id: d.requestedTechnicianId ?? null,
            })
            .single(),
        );
        return mapRequest(row as any);
      },
      async listMine() {
        const uid = await requireUserId();
        const rows = await run<any[]>(
          sb.from('service_requests').select(REQUEST_LIST_SELECT).eq('driver_id', uid).order('created_at', { ascending: false }).limit(100),
        );
        return (rows ?? []).map(mapRequestListItem);
      },
      async get(id) {
        await requireUserId();
        return getDetail(id);
      },
      async cancel(id, reason) {
        await run(sb.rpc('cancel_service_request', { p_request_id: id, p_reason: reason }));
      },
      async respondToQuote(quoteId, accept) {
        await run(sb.rpc('respond_to_quote', { p_quote_id: quoteId, p_accept: accept }));
      },
      async review(input) {
        const d = validate(reviewInputSchema, input);
        await run(
          sb.rpc('submit_review', { p_request_id: d.requestId, p_rating: d.rating, p_comment: d.comment ?? null, p_tags: d.tags }),
        );
      },
      subscribe(id, onChange) {
        return watchRequest(id, onChange);
      },
    },

    pro: {
      async me() {
        await requireUserId();
        const rows = await run<any[]>(sb.rpc('get_my_technician'));
        const row = rows?.[0];
        return row ? mapTechnicianPrivate(row) : null;
      },
      async register(input) {
        await requireUserId();
        const d = validate(technicianInputSchema, input);
        const row = await run<any>(sb.rpc('register_technician', { p_data: d }).single());
        myTechId = null;
        return mapTechnicianPrivate(row as any);
      },
      async update(input) {
        const d = validate(technicianInputSchema, input);
        const row = await run<any>(sb.rpc('update_my_technician', { p_data: d }).single());
        return mapTechnicianPrivate(row as any);
      },
      async setAvailability(availability) {
        await run(sb.rpc('set_my_availability', { p_availability: availability }));
      },
      async heartbeat() {
        await run(sb.rpc('technician_heartbeat'));
      },
      async documents() {
        const techId = await myTechnicianId();
        const rows = await run<any[]>(
          sb.from('technician_documents').select('*').eq('technician_id', techId).order('created_at', { ascending: false }),
        );
        const urls = await signedUrls((rows ?? []).map((r) => r.storage_path));
        return (rows ?? []).map((r) => mapDocument(r, urls.get(r.storage_path) ?? null));
      },
      async uploadDocument(kind, file, fileName) {
        const uid = await requireUserId();
        const techId = await myTechnicianId();
        if (file.size > 5 * 1024 * 1024) throw new BackendError('validation', 'File too large');
        const ext = (fileName.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
        const path = `${uid}/${kind}-${Date.now()}.${ext}`;
        await run(sb.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
        const previous = await run<any[]>(sb.from('technician_documents').select('id,storage_path').eq('technician_id', techId).eq('kind', kind));
        const row = await run<any>(
          sb
            .from('technician_documents')
            .insert({ technician_id: techId, kind, file_name: fileName.slice(0, 200), storage_path: path })
            .select('*')
            .single(),
        );
        if (previous?.length) {
          await sb.from('technician_documents').delete().in('id', previous.map((p) => p.id));
          await sb.storage.from(DOCUMENT_BUCKET).remove(previous.map((p) => p.storage_path));
        }
        const urls = await signedUrls([path]);
        return mapDocument(row, urls.get(path) ?? null);
      },
      async inbox() {
        const rows = await run<any[]>(sb.rpc('technician_inbox'));
        return (rows ?? []).map(mapInboxItem);
      },
      async jobs(scope) {
        const techId = await myTechnicianId();
        let query = sb.from('service_requests').select(REQUEST_LIST_SELECT).eq('technician_id', techId);
        query = scope === 'active' ? query.not('status', 'in', '(completed,cancelled)') : query.in('status', ['completed', 'cancelled']);
        const rows = await run<any[]>(query.order('created_at', { ascending: false }).limit(100));
        return (rows ?? []).map(mapRequestListItem);
      },
      async job(id) {
        await myTechnicianId();
        return getDetail(id);
      },
      async accept(requestId) {
        await run(sb.rpc('accept_service_request', { p_request_id: requestId }));
      },
      async decline(requestId) {
        await run(sb.rpc('decline_service_request', { p_request_id: requestId }));
      },
      async release(requestId, reason) {
        await run(sb.rpc('release_service_request', { p_request_id: requestId, p_reason: reason ?? null }));
      },
      async cancel(requestId, reason) {
        await run(sb.rpc('cancel_service_request', { p_request_id: requestId, p_reason: reason }));
      },
      async advance(requestId, status) {
        await run(sb.rpc('advance_service_request', { p_request_id: requestId, p_status: status }));
      },
      async saveDiagnosis(requestId, diagnosis) {
        await run(sb.rpc('save_diagnosis', { p_request_id: requestId, p_diagnosis: diagnosis }));
      },
      async sendQuote(requestId, input) {
        const d = validate(quoteInputSchema, input);
        await run(sb.rpc('send_quote', { p_request_id: requestId, p_items: d.items, p_note: d.note ?? null }));
      },
      async complete(requestId, input) {
        const d = validate(completeInputSchema, input);
        await run(sb.rpc('complete_service_request', { p_request_id: requestId, p_method: d.method, p_amount: d.amount }));
      },
      async shareLocation(requestId, point) {
        await run(sb.rpc('update_job_location', { p_request_id: requestId, p_lat: point.lat, p_lng: point.lng }));
      },
      async stats() {
        return (await run(sb.rpc('technician_stats'))) as ProStats;
      },
      subscribeInbox(onChange) {
        // Unassigned requests aren't readable by technicians (privacy), so they can't be
        // streamed with postgres_changes; poll the inbox function instead.
        const timer = setInterval(onChange, opts.inboxPollMs ?? 12_000);
        return () => clearInterval(timer);
      },
      subscribeJob(requestId, onChange) {
        return watchRequest(requestId, onChange);
      },
    },

    notifications: {
      async saveDevice(device, options) {
        const d = validate(pushDeviceSchema, device);
        await requireUserId();
        await run(
          sb.rpc('save_push_subscription', {
            p_endpoint: d.endpoint,
            p_p256dh: d.keys.p256dh,
            p_auth: d.keys.auth,
            p_locale: options.locale,
            p_user_agent: options.userAgent ?? null,
          }),
        );
      },
      async forgetDevice(endpoint) {
        // Signed out already: there is nothing left to remove on the server.
        if (!(await currentUserId())) return;
        await run(sb.rpc('delete_push_subscription', { p_endpoint: endpoint }));
      },
    },

    admin: {
      async metrics() {
        return (await run(sb.rpc('admin_metrics'))) as AdminMetrics;
      },
      async technicians(status) {
        const rows = await run<any[]>(sb.rpc('admin_technicians', { p_status: status ?? null }));
        return (rows ?? []).map(mapTechnicianPrivate);
      },
      async technician(id) {
        const rows = await run<any[]>(sb.rpc('admin_technicians', { p_id: id }));
        const row = rows?.[0];
        if (!row) return null;
        const [docs, reviews, perf] = await Promise.all([
          run<any[]>(sb.from('technician_documents').select('*').eq('technician_id', id).order('created_at', { ascending: false })),
          run<any[]>(sb.from('reviews').select(REVIEW_COLUMNS).eq('technician_id', id).order('created_at', { ascending: false }).limit(10)),
          run<any[]>(sb.rpc('admin_technician_performance', { p_technician_id: id })),
        ]);
        const urls = await signedUrls((docs ?? []).map((d) => d.storage_path));
        return {
          technician: mapTechnicianPrivate(row) as TechnicianPrivate,
          documents: (docs ?? []).map((d) => mapDocument(d, urls.get(d.storage_path) ?? null)),
          reviews: (reviews ?? []).map(mapReview),
          performance: perf?.[0] ? mapPerformance(perf[0]) : null,
        };
      },
      async setVerification(id, status, note) {
        if ((status === 'rejected' || status === 'suspended') && !note?.trim()) {
          throw new BackendError('validation', 'Note required', { note: 'required' });
        }
        await run(sb.rpc('admin_set_verification', { p_technician_id: id, p_status: status, p_note: note ?? null }));
      },
      async requests(filter) {
        let query = sb.from('service_requests').select(REQUEST_LIST_SELECT);
        if (filter === 'active') query = query.not('status', 'in', '(completed,cancelled)');
        else if (filter) query = query.eq('status', filter);
        const rows = await run<any[]>(query.order('created_at', { ascending: false }).limit(200));
        return (rows ?? []).map(mapRequestListItem);
      },
      async request(id) {
        return getDetail(id);
      },
      async cancelRequest(id, reason) {
        await run(sb.rpc('cancel_service_request', { p_request_id: id, p_reason: reason }));
      },
      async payments() {
        const rows = await run<any[]>(
          sb
            .from('payments')
            .select('*,request:service_requests(code),technician:technicians(business_name)')
            .order('created_at', { ascending: false })
            .limit(500),
        );
        return (rows ?? []).map(mapPayment);
      },
      async settleCommission(paymentId) {
        await run(sb.rpc('admin_settle_commission', { p_payment_id: paymentId }));
      },
      async reviews() {
        const rows = await run<any[]>(sb.from('reviews').select(REVIEW_COLUMNS).order('created_at', { ascending: false }).limit(200));
        return (rows ?? []).map(mapReview);
      },
      async performance() {
        const rows = await run<any[]>(sb.rpc('admin_technician_performance'));
        return (rows ?? []).map(mapPerformance);
      },
    },
  };
}
