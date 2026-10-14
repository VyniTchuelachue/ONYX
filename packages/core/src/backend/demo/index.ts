import { MAX_ACTIVE_REQUESTS_PER_DRIVER, type RequestStatus, type UserRole } from '../../constants';
import { uuid, generateRequestCode } from '../../domain/codes';
import { effectiveAvailability } from '../../domain/availability';
import { coarsen, haversineKm, interpolate, placeLabelFor } from '../../domain/geo';
import { commissionFor, quoteTotal } from '../../domain/money';
import { canTransition, isActive } from '../../domain/status';
import {
  completeInputSchema,
  createRequestSchema,
  newPasswordSchema,
  passwordResetSchema,
  fieldErrors,
  profilePatchSchema,
  pushDeviceSchema,
  quoteInputSchema,
  reviewInputSchema,
  signInSchema,
  signUpSchema,
  technicianInputSchema,
} from '../../schemas';
import { DEMO_USER_IDS } from '../../seed/technicians';
import { DIAGNOSIS_TEMPLATES, QUOTE_TEMPLATES } from '../../seed/history';
import type {
  InboxItem,
  Profile,
  RequestDetail,
  RequestEvent,
  RequestListItem,
  ServiceRequest,
  Technician,
  TechnicianPrivate,
  TechnicianWithDistance,
} from '../../types';
import { BackendError } from '../errors';
import type { KeyValueStorage } from '../storage';
import type { OnyxBackend, Session } from '../types';
import { computeAdminMetrics, computePerformance, computeProStats } from './metrics';
import { DemoStore, type DemoDb } from './store';
import type { ZodType } from 'zod';

export { createSeedDb, type DemoDb } from './store';

export interface DemoBackendOptions {
  storage: KeyValueStorage;
  /** Subscribe to changes another tab made to storage. */
  watchExternalChanges?: (onChange: () => void) => () => void;
  /** Let seeded technicians accept and progress new requests on their own. Default true. */
  simulate?: boolean;
  /** Artificial latency range, ms. Default [120, 320]. */
  latencyMs?: [number, number];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BackendError('validation', 'Invalid input', fieldErrors(result.error));
  return result.data;
}

function toPublic(t: TechnicianPrivate): Technician {
  const { userId: _u, verificationNote: _n, verifiedAt: _v, ...pub } = t;
  return pub;
}

export async function createDemoBackend(opts: DemoBackendOptions): Promise<OnyxBackend> {
  const store = await DemoStore.open(opts.storage);
  const [minLatency, maxLatency] = opts.latencyMs ?? [120, 320];
  const delay = () => new Promise((r) => setTimeout(r, minLatency + Math.random() * (maxLatency - minLatency)));
  const db = (): DemoDb => store.db;
  const now = () => new Date();
  const iso = () => now().toISOString();

  // ── helpers ────────────────────────────────────────────────────────────────
  const profileOf = (id: string | null) => (id ? (db().profiles.find((p) => p.id === id) ?? null) : null);
  const me = (): Profile | null => profileOf(db().sessionUserId);
  const requireMe = (): Profile => {
    const p = me();
    if (!p) throw new BackendError('unauthenticated');
    return p;
  };
  const requireAdmin = (): Profile => {
    const p = requireMe();
    if (p.role !== 'admin') throw new BackendError('forbidden');
    return p;
  };
  const techById = (id: string | null) => (id ? (db().technicians.find((t) => t.id === id) ?? null) : null);
  const myTech = (): TechnicianPrivate | null => {
    const p = me();
    return p ? (db().technicians.find((t) => t.userId === p.id) ?? null) : null;
  };
  const requireTech = (verified = true): TechnicianPrivate => {
    requireMe();
    const t = myTech();
    if (!t) throw new BackendError('forbidden', 'No technician listing');
    if (verified && t.verificationStatus !== 'verified') throw new BackendError('forbidden', 'Technician not verified');
    return t;
  };
  const requestById = (id: string): ServiceRequest => {
    const r = db().requests.find((x) => x.id === id);
    if (!r) throw new BackendError('not_found');
    return r;
  };
  const log = (r: ServiceRequest, type: RequestEvent['type'], actorRole: UserRole | null, data: RequestEvent['data'] = null) => {
    const at = iso();
    db().events.push({ id: uuid(), requestId: r.id, type, actorRole, message: null, data, createdAt: at });
    r.updatedAt = at;
  };
  const move = (r: ServiceRequest, to: RequestStatus, actor: UserRole) => {
    if (!canTransition(r.status, to, actor)) throw new BackendError('invalid_transition', `${r.status} → ${to}`);
    r.status = to;
  };
  const hasOtherActiveJobs = (t: TechnicianPrivate, exceptId: string) =>
    db().requests.some((r) => r.technicianId === t.id && r.id !== exceptId && isActive(r.status));
  const freeUp = (t: TechnicianPrivate | null, requestId: string) => {
    if (t && t.availability === 'busy' && !hasOtherActiveJobs(t, requestId)) {
      t.availability = 'available';
      t.availabilityUpdatedAt = iso();
    }
  };

  const listItem = (r: ServiceRequest): RequestListItem => {
    const t = techById(r.technicianId);
    const accepted = db().quotes.find((q) => q.requestId === r.id && q.status === 'accepted');
    return { ...clone(r), technicianName: t?.businessName ?? null, technicianPhone: t?.phone ?? null, acceptedTotal: accepted?.total ?? null };
  };

  const detail = (r: ServiceRequest): RequestDetail => {
    const t = techById(r.technicianId);
    const requested = techById(r.requestedTechnicianId);
    return clone({
      request: r,
      technician: t ? toPublic(t) : null,
      requestedTechnician: requested ? toPublic(requested) : null,
      quotes: db().quotes.filter((q) => q.requestId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      events: db().events.filter((e) => e.requestId === r.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      review: db().reviews.find((x) => x.requestId === r.id) ?? null,
      payment: db().payments.find((p) => p.requestId === r.id) ?? null,
    });
  };

  const sessionFor = (p: Profile): Session => ({ userId: p.id, email: p.email, profile: clone(p) });

  // ── auth listeners ─────────────────────────────────────────────────────────
  const authListeners = new Set<(s: Session | null) => void>();
  let lastSessionId = db().sessionUserId;
  const unsubscribeStore = store.subscribe(() => {
    const current = db().sessionUserId;
    if (current !== lastSessionId) {
      lastSessionId = current;
      const p = me();
      for (const l of authListeners) l(p ? sessionFor(p) : null);
    }
  });
  const unwatch = opts.watchExternalChanges?.(() => void store.reload());

  // ── simulator ──────────────────────────────────────────────────────────────
  const SIM = { directAcceptMs: 6_000, broadcastAcceptMs: 12_000, enRouteMs: 4_000, diagnoseMs: 7_000, workMs: 18_000 };
  const since = (t: string | null) => (t ? now().getTime() - new Date(t).getTime() : 0);

  function simulateTick() {
    const d = db();
    let changed = false;
    for (const r of d.requests) {
      if (!isActive(r.status) || r.createdAt < d.createdAt) continue;
      const assigned = techById(r.technicianId);
      if (r.status === 'pending') {
        const requested = techById(r.requestedTechnicianId);
        let candidate: TechnicianPrivate | null = null;
        if (requested) {
          if (requested.userId === null && since(r.createdAt) > SIM.directAcceptMs) candidate = requested;
        } else if (since(r.createdAt) > SIM.broadcastAcceptMs) {
          const declined = new Set(d.declines.filter((x) => x.requestId === r.id).map((x) => x.technicianId));
          candidate =
            d.technicians
              .filter((t) => t.userId === null && t.verificationStatus === 'verified' && t.availability !== 'offline' && !declined.has(t.id))
              .map((t) => ({ t, km: haversineKm(t.location, r.location) }))
              .filter(({ km }) => km <= 80)
              .sort((a, b) => a.km - b.km)[0]?.t ?? null;
        }
        if (candidate) {
          r.technicianId = candidate.id;
          r.status = 'accepted';
          r.acceptedAt = iso();
          candidate.availability = 'busy';
          candidate.availabilityUpdatedAt = iso();
          log(r, 'accepted', 'technician', { technicianName: candidate.businessName });
          changed = true;
        }
        continue;
      }
      if (!assigned || assigned.userId !== null) continue;
      switch (r.status) {
        case 'accepted':
          if (since(r.acceptedAt) > SIM.enRouteMs) {
            r.status = 'en_route';
            r.enRouteAt = iso();
            r.technicianLocation = { ...assigned.location, at: iso() };
            log(r, 'en_route', 'technician');
            changed = true;
          }
          break;
        case 'en_route': {
          const km = haversineKm(assigned.location, r.location);
          const travelMs = Math.min(35_000, Math.max(15_000, km * 3_000));
          const frac = since(r.enRouteAt) / travelMs;
          if (frac >= 1) {
            r.status = 'arrived';
            r.arrivedAt = iso();
            r.technicianLocation = { ...r.location, at: iso() };
            log(r, 'arrived', 'technician');
          } else {
            r.technicianLocation = { ...interpolate(assigned.location, r.location, frac), at: iso() };
          }
          changed = true;
          break;
        }
        case 'arrived': {
          if (since(r.arrivedAt) > SIM.diagnoseMs) {
            const previous = d.quotes.filter((q) => q.requestId === r.id);
            const template = QUOTE_TEMPLATES[r.category][0]!;
            // After a declined quote, come back 10% cheaper.
            const factor = previous.length ? 0.9 : 1;
            const items = template.map((it) => ({ ...it, unitPrice: Math.round((it.unitPrice * factor) / 100) * 100 }));
            if (!r.diagnosis) {
              r.diagnosis = DIAGNOSIS_TEMPLATES[r.category];
              log(r, 'diagnosis', 'technician');
            }
            const quote = {
              id: uuid(),
              requestId: r.id,
              technicianId: assigned.id,
              items,
              total: quoteTotal(items),
              note: previous.length ? 'Nouveau prix après discussion.' : 'Pièces disponibles immédiatement.',
              status: 'pending' as const,
              createdAt: iso(),
              respondedAt: null,
            };
            d.quotes.push(quote);
            r.status = 'quoted';
            log(r, 'quote_sent', 'technician', { total: quote.total });
            changed = true;
          }
          break;
        }
        case 'in_progress':
          if (since(r.startedAt) > SIM.workMs) {
            const accepted = d.quotes.find((q) => q.requestId === r.id && q.status === 'accepted');
            completeRequest(r, assigned, 'cash', accepted?.total ?? 7000);
            changed = true;
          }
          break;
      }
    }
    if (changed) store.mutate(() => undefined);
  }

  function completeRequest(r: ServiceRequest, t: TechnicianPrivate, method: 'cash' | 'mtn_momo' | 'orange_money', amount: number) {
    const at = iso();
    r.status = 'completed';
    r.completedAt = at;
    const accepted = db().quotes.find((q) => q.requestId === r.id && q.status === 'accepted');
    db().payments.push({
      id: uuid(),
      requestId: r.id,
      requestCode: r.code,
      quoteId: accepted?.id ?? null,
      technicianId: t.id,
      technicianName: t.businessName,
      amount,
      commission: commissionFor(amount),
      method,
      status: 'paid',
      paidAt: at,
      commissionSettledAt: null,
      createdAt: at,
    });
    t.jobsCompleted += 1;
    freeUp(t, r.id);
    log(r, 'completed', 'technician', { amount, method });
  }

  const simTimer = opts.simulate === false ? null : setInterval(simulateTick, 1500);

  // ── ports ──────────────────────────────────────────────────────────────────
  const backend: OnyxBackend = {
    mode: 'demo',
    dispose() {
      if (simTimer) clearInterval(simTimer);
      unsubscribeStore();
      unwatch?.();
      store.flush();
    },

    auth: {
      async getSession() {
        const p = me();
        return p ? sessionFor(p) : null;
      },
      onChange(listener) {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
      async signIn(input) {
        const data = validate(signInSchema, input);
        await delay();
        const p = db().profiles.find((x) => x.email?.toLowerCase() === data.email.toLowerCase());
        if (!p) throw new BackendError('invalid_credentials');
        store.mutate((d) => (d.sessionUserId = p.id));
        return sessionFor(p);
      },
      async signUp(input) {
        const data = validate(signUpSchema, input);
        await delay();
        if (db().profiles.some((x) => x.email?.toLowerCase() === data.email.toLowerCase())) throw new BackendError('email_taken');
        const profile: Profile = {
          id: uuid(),
          role: 'driver',
          fullName: data.fullName,
          email: data.email,
          phone: data.phone ?? null,
          locale: data.locale,
          defaultVehicle: null,
          createdAt: iso(),
        };
        store.mutate((d) => {
          d.profiles.push(profile);
          d.sessionUserId = profile.id;
        });
        return { session: sessionFor(profile), needsEmailConfirmation: false };
      },
      // Demo accounts have no real passwords and no mailbox: validate, then succeed.
      async requestPasswordReset(email) {
        validate(passwordResetSchema, { email });
        await delay();
      },
      async updatePassword(password) {
        validate(newPasswordSchema, { password });
        requireMe();
        await delay();
      },
      async signOut() {
        store.mutate((d) => (d.sessionUserId = null));
      },
      async updateProfile(patch) {
        const p = requireMe();
        const data = validate(profilePatchSchema, patch);
        await delay();
        store.mutate(() => {
          if (data.fullName !== undefined) p.fullName = data.fullName;
          if (data.phone !== undefined) p.phone = data.phone;
          if (data.locale !== undefined) p.locale = data.locale;
          if (data.defaultVehicle !== undefined) p.defaultVehicle = data.defaultVehicle;
        });
        return clone(p);
      },
      async getAccessToken() {
        return null;
      },
      demo: {
        accounts: [
          { role: 'driver', userId: DEMO_USER_IDS.driver, name: 'Arielle Ekambi' },
          { role: 'technician', userId: DEMO_USER_IDS.technician, name: 'Jean-Paul Mbarga' },
          { role: 'admin', userId: DEMO_USER_IDS.admin, name: 'Équipe ONYX' },
        ],
        async signInAs(role) {
          await delay();
          const p = profileOf(DEMO_USER_IDS[role]);
          if (!p) throw new BackendError('not_found');
          store.mutate((d) => (d.sessionUserId = p.id));
          return sessionFor(p);
        },
        async reset() {
          store.reset(true);
        },
      },
    },

    directory: {
      async nearby(q) {
        await delay();
        const n = now();
        return db()
          .technicians.filter((t) => t.verificationStatus === 'verified')
          .map((t): TechnicianWithDistance => ({ ...toPublic(t), distanceKm: haversineKm(q.center, t.location) }))
          .filter((t) => (q.corridor ? t.corridors.includes(q.corridor) : t.distanceKm <= q.radiusKm))
          .filter((t) => !q.specialty || t.specialties.includes(q.specialty))
          .filter((t) => !q.availableOnly || effectiveAvailability(t, n) === 'available')
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, q.limit ?? 60)
          .map(clone);
      },
      async get(id) {
        await delay();
        const t = techById(id);
        if (!t) return null;
        const viewer = me();
        const allowed = t.verificationStatus === 'verified' || viewer?.role === 'admin' || (viewer && t.userId === viewer.id);
        return allowed ? clone(toPublic(t)) : null;
      },
      async reviews(technicianId, limit = 20) {
        await delay();
        return clone(
          db()
            .reviews.filter((r) => r.technicianId === technicianId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, limit),
        );
      },
      async snapshot(center, radiusKm) {
        await delay();
        return clone(
          db()
            .technicians.filter((t) => t.verificationStatus === 'verified' && haversineKm(center, t.location) <= radiusKm)
            .map(toPublic),
        );
      },
    },

    requests: {
      async create(input) {
        const p = requireMe();
        const data = validate(createRequestSchema, input);
        await delay();
        const active = db().requests.filter((r) => r.driverId === p.id && isActive(r.status)).length;
        if (active >= MAX_ACTIVE_REQUESTS_PER_DRIVER) throw new BackendError('limit_reached');
        if (data.requestedTechnicianId) {
          const t = techById(data.requestedTechnicianId);
          if (!t || t.verificationStatus !== 'verified') throw new BackendError('not_found', 'Technician not available');
        }
        const at = iso();
        const r: ServiceRequest = {
          id: uuid(),
          code: generateRequestCode(),
          driverId: p.id,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          requestedTechnicianId: data.requestedTechnicianId ?? null,
          technicianId: null,
          status: 'pending',
          category: data.category,
          description: data.description,
          urgency: data.urgency,
          aiSummary: data.aiSummary ?? null,
          vehicle: data.vehicle,
          location: data.location,
          landmark: data.landmark,
          placeLabel: input.placeLabel ?? placeLabelFor(data.location),
          diagnosis: null,
          technicianLocation: null,
          createdAt: at,
          acceptedAt: null,
          enRouteAt: null,
          arrivedAt: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
          cancelledBy: null,
          updatedAt: at,
        };
        store.mutate((d) => {
          d.requests.unshift(r);
          log(r, 'created', 'driver');
        });
        return clone(r);
      },
      async listMine() {
        const p = requireMe();
        await delay();
        return db()
          .requests.filter((r) => r.driverId === p.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(listItem);
      },
      async get(id) {
        const p = requireMe();
        await delay();
        const r = db().requests.find((x) => x.id === id);
        if (!r) return null;
        const t = techById(r.technicianId);
        const allowed = r.driverId === p.id || p.role === 'admin' || (t && t.userId === p.id);
        return allowed ? detail(r) : null;
      },
      async cancel(id, reason) {
        const p = requireMe();
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          if (r.driverId !== p.id) throw new BackendError('forbidden');
          move(r, 'cancelled', 'driver');
          r.cancelledAt = iso();
          r.cancelledBy = 'driver';
          r.cancelReason = reason.slice(0, 300);
          freeUp(techById(r.technicianId), r.id);
          log(r, 'cancelled', 'driver', { reason: r.cancelReason });
        });
      },
      async respondToQuote(quoteId, accept) {
        const p = requireMe();
        await delay();
        store.mutate((d) => {
          const q = d.quotes.find((x) => x.id === quoteId);
          if (!q) throw new BackendError('not_found');
          const r = requestById(q.requestId);
          if (r.driverId !== p.id) throw new BackendError('forbidden');
          if (q.status !== 'pending') throw new BackendError('invalid_transition');
          move(r, accept ? 'in_progress' : 'arrived', 'driver');
          q.status = accept ? 'accepted' : 'declined';
          q.respondedAt = iso();
          if (accept) r.startedAt = iso();
          log(r, accept ? 'quote_accepted' : 'quote_declined', 'driver', { total: q.total });
          if (!accept) r.arrivedAt = iso();
        });
      },
      async review(input) {
        const p = requireMe();
        const data = validate(reviewInputSchema, input);
        await delay();
        store.mutate((d) => {
          const r = requestById(data.requestId);
          if (r.driverId !== p.id) throw new BackendError('forbidden');
          if (r.status !== 'completed' || !r.technicianId) throw new BackendError('invalid_transition');
          if (d.reviews.some((x) => x.requestId === r.id)) throw new BackendError('conflict');
          const t = techById(r.technicianId)!;
          const parts = p.fullName.trim().split(/\s+/);
          d.reviews.push({
            id: uuid(),
            requestId: r.id,
            technicianId: t.id,
            reviewerName: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : (parts[0] ?? ''),
            rating: data.rating,
            comment: data.comment ?? null,
            tags: data.tags,
            createdAt: iso(),
          });
          t.ratingAvg = Math.round(((t.ratingAvg * t.ratingCount + data.rating) / (t.ratingCount + 1)) * 100) / 100;
          t.ratingCount += 1;
          log(r, 'reviewed', 'driver', { rating: data.rating });
        });
      },
      subscribe(_id, onChange) {
        return store.subscribe(onChange);
      },
    },

    pro: {
      async me() {
        requireMe();
        await delay();
        const t = myTech();
        return t ? clone(t) : null;
      },
      async register(input) {
        const p = requireMe();
        const data = validate(technicianInputSchema, input);
        await delay();
        if (myTech()) throw new BackendError('conflict', 'Listing already exists');
        const at = iso();
        const t: TechnicianPrivate = {
          id: uuid(),
          userId: p.id,
          businessName: data.businessName,
          ownerName: data.ownerName,
          bio: data.bio ?? null,
          phone: data.phone,
          whatsapp: data.whatsapp ?? null,
          specialties: data.specialties,
          vehicleTypes: data.vehicleTypes,
          location: data.location,
          address: data.address ?? null,
          area: data.area,
          city: data.city,
          corridors: data.corridors,
          serviceRadiusKm: data.serviceRadiusKm,
          mobileService: data.mobileService,
          hasTowTruck: data.hasTowTruck,
          openingHours: data.openingHours ?? null,
          yearsExperience: data.yearsExperience ?? null,
          photoUrl: null,
          verificationStatus: 'pending',
          verificationNote: null,
          verifiedAt: null,
          availability: 'offline',
          availabilityUpdatedAt: at,
          lastSeenAt: at,
          ratingAvg: 0,
          ratingCount: 0,
          jobsCompleted: 0,
          avgResponseMinutes: null,
          createdAt: at,
        };
        store.mutate((d) => {
          d.technicians.push(t);
          if (p.role === 'driver') p.role = 'technician';
        });
        return clone(t);
      },
      async update(input) {
        const t = requireTech(false);
        const data = validate(technicianInputSchema, input);
        await delay();
        store.mutate(() => {
          Object.assign(t, {
            businessName: data.businessName,
            ownerName: data.ownerName,
            bio: data.bio ?? null,
            phone: data.phone,
            whatsapp: data.whatsapp ?? null,
            specialties: data.specialties,
            vehicleTypes: data.vehicleTypes,
            location: data.location,
            address: data.address ?? null,
            area: data.area,
            city: data.city,
            corridors: data.corridors,
            serviceRadiusKm: data.serviceRadiusKm,
            mobileService: data.mobileService,
            hasTowTruck: data.hasTowTruck,
            openingHours: data.openingHours ?? null,
            yearsExperience: data.yearsExperience ?? null,
          });
        });
        return clone(t);
      },
      async setAvailability(availability) {
        const t = requireTech(false);
        await delay();
        store.mutate(() => {
          t.availability = availability;
          t.availabilityUpdatedAt = iso();
          t.lastSeenAt = iso();
        });
      },
      async heartbeat() {
        const t = myTech();
        if (t) store.mutate(() => (t.lastSeenAt = iso()));
      },
      async documents() {
        const t = requireTech(false);
        await delay();
        return clone(db().documents.filter((x) => x.technicianId === t.id));
      },
      async uploadDocument(kind, file, fileName) {
        const t = requireTech(false);
        if (file.size > 5 * 1024 * 1024) throw new BackendError('validation', 'File too large');
        let url: string | null = null;
        if (file.size <= 400_000 && typeof btoa === 'function') {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
          url = `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
        }
        await delay();
        const doc = {
          id: uuid(),
          technicianId: t.id,
          kind,
          fileName: fileName.slice(0, 200),
          storagePath: `${t.id}/${kind}-${Date.now()}`,
          url,
          createdAt: iso(),
        };
        store.mutate((d) => {
          d.documents = d.documents.filter((x) => !(x.technicianId === t.id && x.kind === kind));
          d.documents.push(doc);
        });
        return clone(doc);
      },
      async inbox() {
        const t = requireTech(false);
        await delay();
        if (t.verificationStatus !== 'verified') return [];
        const cutoff = now().getTime() - 24 * 3600_000;
        const declined = new Set(db().declines.filter((x) => x.technicianId === t.id).map((x) => x.requestId));
        return db()
          .requests.filter((r) => r.status === 'pending' && !r.technicianId && new Date(r.createdAt).getTime() >= cutoff)
          .map((r) => ({ r, km: haversineKm(t.location, r.location) }))
          .filter(
            ({ r, km }) =>
              r.requestedTechnicianId === t.id ||
              (r.requestedTechnicianId === null && t.availability === 'available' && km <= t.serviceRadiusKm && !declined.has(r.id)),
          )
          .map(
            ({ r, km }): InboxItem => ({
              id: r.id,
              code: r.code,
              category: r.category,
              description: r.description,
              urgency: r.urgency,
              aiSummary: r.aiSummary,
              vehicle: clone(r.vehicle),
              placeLabel: r.placeLabel,
              approxLocation: coarsen(r.location),
              distanceKm: Math.round(km * 10) / 10,
              isDirect: r.requestedTechnicianId === t.id,
              createdAt: r.createdAt,
            }),
          )
          .sort((a, b) => Number(b.isDirect) - Number(a.isDirect) || b.createdAt.localeCompare(a.createdAt));
      },
      async jobs(scope) {
        const t = requireTech(false);
        await delay();
        return db()
          .requests.filter((r) => r.technicianId === t.id && (scope === 'active' ? isActive(r.status) : !isActive(r.status)))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(listItem);
      },
      async job(id) {
        const t = requireTech(false);
        await delay();
        const r = db().requests.find((x) => x.id === id);
        return r && r.technicianId === t.id ? detail(r) : null;
      },
      async accept(id) {
        const t = requireTech();
        await delay();
        store.mutate((d) => {
          const r = requestById(id);
          if (r.status !== 'pending' || r.technicianId) throw new BackendError('conflict');
          const eligible =
            r.requestedTechnicianId === t.id ||
            (r.requestedTechnicianId === null &&
              haversineKm(t.location, r.location) <= t.serviceRadiusKm &&
              !d.declines.some((x) => x.requestId === r.id && x.technicianId === t.id));
          if (!eligible) throw new BackendError('forbidden');
          r.technicianId = t.id;
          r.status = 'accepted';
          r.acceptedAt = iso();
          const minutes = (Date.now() - new Date(r.createdAt).getTime()) / 60000;
          t.avgResponseMinutes = Math.round(t.avgResponseMinutes === null ? minutes : t.avgResponseMinutes * 0.8 + minutes * 0.2);
          t.availability = 'busy';
          t.availabilityUpdatedAt = iso();
          log(r, 'accepted', 'technician', { technicianName: t.businessName });
        });
      },
      async decline(id) {
        const t = requireTech();
        await delay();
        store.mutate((d) => {
          const r = requestById(id);
          if (r.status !== 'pending') throw new BackendError('invalid_transition');
          if (!d.declines.some((x) => x.requestId === r.id && x.technicianId === t.id)) {
            d.declines.push({ requestId: r.id, technicianId: t.id });
          }
          if (r.requestedTechnicianId === t.id) {
            r.requestedTechnicianId = null;
            log(r, 'declined', 'technician', { technicianName: t.businessName });
          }
        });
      },
      async release(id, reason) {
        const t = requireTech(false);
        await delay();
        store.mutate((d) => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          move(r, 'pending', 'technician');
          r.technicianId = null;
          r.requestedTechnicianId = null;
          r.acceptedAt = null;
          r.enRouteAt = null;
          r.technicianLocation = null;
          d.declines.push({ requestId: r.id, technicianId: t.id });
          freeUp(t, r.id);
          log(r, 'released', 'technician', { reason: reason ?? null });
        });
      },
      async cancel(id, reason) {
        const t = requireTech(false);
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          move(r, 'cancelled', 'technician');
          r.cancelledAt = iso();
          r.cancelledBy = 'technician';
          r.cancelReason = reason.slice(0, 300);
          freeUp(t, r.id);
          log(r, 'cancelled', 'technician', { reason: r.cancelReason });
        });
      },
      async advance(id, status) {
        const t = requireTech(false);
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          move(r, status, 'technician');
          const at = iso();
          if (status === 'en_route') {
            r.enRouteAt = at;
            log(r, 'en_route', 'technician');
          } else if (status === 'arrived') {
            r.arrivedAt = at;
            r.technicianLocation = null;
            log(r, 'arrived', 'technician');
          } else {
            r.startedAt = at;
            log(r, 'started', 'technician');
          }
        });
      },
      async saveDiagnosis(id, diagnosis) {
        const t = requireTech(false);
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          if (!['arrived', 'quoted', 'in_progress'].includes(r.status)) throw new BackendError('invalid_transition');
          r.diagnosis = diagnosis.trim().slice(0, 2000) || null;
          log(r, 'diagnosis', 'technician');
        });
      },
      async sendQuote(id, input) {
        const t = requireTech(false);
        const data = validate(quoteInputSchema, input);
        await delay();
        store.mutate((d) => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          if (r.status !== 'arrived' && r.status !== 'quoted') throw new BackendError('invalid_transition');
          for (const q of d.quotes) if (q.requestId === r.id && q.status === 'pending') q.status = 'superseded';
          const total = quoteTotal(data.items);
          d.quotes.push({
            id: uuid(),
            requestId: r.id,
            technicianId: t.id,
            items: data.items,
            total,
            note: data.note ?? null,
            status: 'pending',
            createdAt: iso(),
            respondedAt: null,
          });
          r.status = 'quoted';
          log(r, 'quote_sent', 'technician', { total });
        });
      },
      async complete(id, input) {
        const t = requireTech(false);
        const data = validate(completeInputSchema, input);
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          if (!canTransition(r.status, 'completed', 'technician')) throw new BackendError('invalid_transition');
          completeRequest(r, t, data.method, data.amount);
        });
      },
      async shareLocation(id, point) {
        const t = requireTech(false);
        store.mutate(() => {
          const r = requestById(id);
          if (r.technicianId !== t.id) throw new BackendError('forbidden');
          if (r.status !== 'accepted' && r.status !== 'en_route') return;
          r.technicianLocation = { lat: point.lat, lng: point.lng, at: iso() };
          t.lastSeenAt = iso();
        });
      },
      async stats() {
        const t = requireTech(false);
        await delay();
        return computeProStats(db(), t);
      },
      subscribeInbox(onChange) {
        return store.subscribe(onChange);
      },
      subscribeJob(_id, onChange) {
        return store.subscribe(onChange);
      },
    },

    // The demo has no push server: the web app shows its alerts itself while it is open.
    notifications: {
      async saveDevice(device) {
        validate(pushDeviceSchema, device);
        requireMe();
      },
      async forgetDevice() {},
    },

    admin: {
      async metrics() {
        requireAdmin();
        await delay();
        return computeAdminMetrics(db());
      },
      async technicians(status) {
        requireAdmin();
        await delay();
        return clone(
          db()
            .technicians.filter((t) => !status || t.verificationStatus === status)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      },
      async technician(id) {
        requireAdmin();
        await delay();
        const t = techById(id);
        if (!t) return null;
        return clone({
          technician: t,
          documents: db().documents.filter((x) => x.technicianId === id),
          reviews: db()
            .reviews.filter((r) => r.technicianId === id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 10),
          performance: computePerformance(db(), t),
        });
      },
      async setVerification(id, status, note) {
        const admin = requireAdmin();
        if ((status === 'rejected' || status === 'suspended') && !note?.trim()) {
          throw new BackendError('validation', 'Note required', { note: 'required' });
        }
        await delay();
        store.mutate(() => {
          const t = techById(id);
          if (!t) throw new BackendError('not_found');
          t.verificationStatus = status;
          t.verificationNote = note?.trim() || null;
          t.verifiedAt = status === 'verified' ? iso() : t.verifiedAt;
          if (status !== 'verified') t.availability = 'offline';
          void admin;
        });
      },
      async requests(filter) {
        requireAdmin();
        await delay();
        return db()
          .requests.filter((r) => !filter || (filter === 'active' ? isActive(r.status) : r.status === filter))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 200)
          .map(listItem);
      },
      async request(id) {
        requireAdmin();
        await delay();
        const r = db().requests.find((x) => x.id === id);
        return r ? detail(r) : null;
      },
      async cancelRequest(id, reason) {
        requireAdmin();
        await delay();
        store.mutate(() => {
          const r = requestById(id);
          move(r, 'cancelled', 'admin');
          r.cancelledAt = iso();
          r.cancelledBy = 'admin';
          r.cancelReason = reason.slice(0, 300);
          freeUp(techById(r.technicianId), r.id);
          log(r, 'cancelled', 'admin', { reason: r.cancelReason });
        });
      },
      async payments() {
        requireAdmin();
        await delay();
        return clone(db().payments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      async settleCommission(paymentId) {
        requireAdmin();
        await delay();
        store.mutate((d) => {
          const p = d.payments.find((x) => x.id === paymentId);
          if (!p) throw new BackendError('not_found');
          p.commissionSettledAt = p.commissionSettledAt ?? iso();
        });
      },
      async reviews() {
        requireAdmin();
        await delay();
        return clone(db().reviews.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      async performance() {
        requireAdmin();
        await delay();
        return db()
          .technicians.filter((t) => t.verificationStatus === 'verified')
          .map((t) => computePerformance(db(), t))
          .sort((a, b) => b.revenue30d - a.revenue30d || b.jobsCompleted30d - a.jobsCompleted30d);
      },
    },
  };

  return backend;
}
