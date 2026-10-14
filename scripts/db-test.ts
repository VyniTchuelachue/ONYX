/**
 * Runs the Supabase migrations + seed in an embedded Postgres (PGlite) with the
 * Supabase roles stubbed, then exercises the security rules and the job lifecycle
 * end to end as different users.
 *
 *   npm run db:test
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { REQUEST_STATUSES, USER_ROLES, canTransition } from '@onyx/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

const SUPABASE_STUBS = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create publication supabase_realtime;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
`;

// ── tiny test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function ok(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m`);
  }
}

type Row = Record<string, any>;

/** Run SQL as a given user (null = anonymous visitor). */
async function as(uid: string | null, sql: string, params: unknown[] = []): Promise<Row[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'};`);
  try {
    const res = await db.query<Row>(sql, params);
    return res.rows;
  } finally {
    await db.exec('reset role;');
  }
}

/** Run SQL as the app server (service role), e.g. the alert sender. */
async function asService(sql: string, params: unknown[] = []): Promise<Row[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  try {
    const res = await db.query<Row>(sql, params);
    return res.rows;
  } finally {
    await db.exec('reset role;');
  }
}

async function expectError(uid: string | null, sql: string, params: unknown[], pattern: RegExp, label: string) {
  try {
    await as(uid, sql, params);
    ok(false, `${label} (no error raised)`);
  } catch (e) {
    const msg = (e as Error).message;
    ok(pattern.test(msg), `${label} → ${msg.slice(0, 80)}`);
  }
}

async function createUser(email: string, fullName: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify({ full_name: fullName, phone: '+237699000000', locale: 'fr' }),
  ]);
  return id;
}

const TECH1 = '00000000-0000-4000-8000-000000000001';
const PENDING_TECH = '00000000-0000-4000-8000-000000000016'; // n = 22

const createRequestSql = `
  select * from public.create_service_request(
    p_category => $1, p_description => 'Clics au démarrage', p_urgency => 'medium', p_ai_summary => 'Batterie probable',
    p_vehicle => '{"type":"car","make":"Toyota"}'::jsonb, p_lat => $2, p_lng => $3, p_landmark => 'Face à la pharmacie',
    p_place_label => 'Akwa, Douala', p_contact_name => 'Arielle Ekambi', p_contact_phone => '+237699000000',
    p_requested_technician_id => $4)`;

async function main() {
  console.log('Applying Supabase stubs, migrations and seed…');
  await db.exec(SUPABASE_STUBS);
  const migrationsDir = path.join(root, 'supabase', 'migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
    console.log(`  applied ${file}`);
  }
  await db.exec(readFileSync(path.join(root, 'supabase', 'seed.sql'), 'utf8'));

  console.log('\nRules shared with the apps');
  let mismatches = 0;
  for (const from of REQUEST_STATUSES) {
    for (const to of REQUEST_STATUSES) {
      for (const actor of USER_ROLES) {
        const res = await db.query<{ ok: boolean }>(`select public.can_transition($1, $2, $3) as ok`, [from, to, actor]);
        if (res.rows[0]!.ok !== canTransition(from, to, actor)) {
          mismatches++;
          console.log(`    mismatch: ${actor} ${from} → ${to}`);
        }
      }
    }
  }
  ok(mismatches === 0, `SQL and TypeScript agree on all ${REQUEST_STATUSES.length ** 2 * USER_ROLES.length} status transitions`);

  const driverA = await createUser('arielle@example.cm', 'Arielle Ekambi');
  const driverB = await createUser('franck@example.cm', 'Franck Tchatchoua');
  const techUser = await createUser('jeanpaul@example.cm', 'Jean-Paul Mbarga');
  const newTechUser = await createUser('lionel@example.cm', 'Lionel Kotto');
  const adminUser = await createUser('ops@example.cm', 'Ops');
  await db.query(`update public.technicians set user_id = $1 where id = $2`, [techUser, TECH1]);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [adminUser]);

  console.log('\nProfiles');
  const profile = await as(driverA, `select * from public.profiles`);
  ok(profile.length === 1 && profile[0]!.full_name === 'Arielle Ekambi' && profile[0]!.role === 'driver', 'sign-up creates a driver profile, users see only their own');
  await expectError(driverA, `update public.profiles set role = 'admin' where id = auth.uid()`, [], /permission denied/, 'drivers cannot promote themselves');
  await as(driverA, `update public.profiles set full_name = 'Arielle E.' where id = auth.uid()`);
  ok((await as(driverA, `select full_name from public.profiles`))[0]!.full_name === 'Arielle E.', 'users can rename themselves');
  await as(driverA, `update public.profiles set full_name = 'Arielle Ekambi' where id = auth.uid()`);
  ok((await as(adminUser, `select count(*)::int as n from public.profiles`))[0]!.n === 5, 'admins read every profile');

  console.log('\nPublic directory');
  const visible = await as(null, `select count(*)::int as n from public.technicians`);
  ok(visible[0]!.n === 31, `anonymous visitors see only verified technicians (${visible[0]!.n})`);
  await expectError(null, `select user_id from public.technicians`, [], /permission denied/, 'private columns are hidden');
  const nearby = await as(null, `select id, business_name, distance_km from public.nearby_technicians(4.0525, 9.6963, 5)`);
  ok(nearby.length > 3 && nearby[0]!.id === TECH1, `nearby_technicians sorts by distance (${nearby.length} within 5 km of Akwa)`);
  ok(nearby.every((r, i) => i === 0 || r.distance_km >= nearby[i - 1]!.distance_km), 'distances are ascending');
  const tyres = await as(null, `select specialties from public.nearby_technicians(4.0525, 9.6963, 30, 'tires')`);
  ok(tyres.length > 0 && tyres.every((r) => r.specialties.includes('tires')), 'specialty filter works');
  const n3 = await as(null, `select city from public.nearby_technicians(3.85, 10.5, 15, null, false, 'douala-yaounde')`);
  ok(n3.length >= 4 && n3.some((r) => r.city === 'Pouma'), `corridor filter lists the Douala–Yaoundé road (${n3.length})`);
  const reviewsAnon = await as(null, `select id, rating from public.reviews`);
  ok(Array.isArray(reviewsAnon), 'reviews are public');
  await expectError(null, `select driver_id from public.reviews`, [], /permission denied/, "reviewers' account ids are hidden");
  await expectError(null, `select * from public.create_service_request('battery','x','medium',null,'{}',4,9,'abc','x','Name','+237699000000')`, [], /permission denied/, 'anonymous visitors cannot create requests');

  console.log('\nDirect request → full job');
  const [req] = await as(driverA, createRequestSql, ['battery', 4.0531, 9.7002, TECH1]);
  ok(req && req.status === 'pending' && /^ONX-[2-9A-HJ-KM-NP-Z]{5}$/.test(req.code), `driver creates a request (${req?.code})`);
  ok((await as(driverB, `select count(*)::int as n from public.service_requests`))[0]!.n === 0, "other drivers can't see it");
  ok((await as(techUser, `select count(*)::int as n from public.service_requests`))[0]!.n === 0, "the technician can't read it before accepting");
  const inbox = await as(techUser, `select * from public.technician_inbox()`);
  ok(inbox.length === 1 && inbox[0]!.is_direct === true, 'it reaches the requested technician’s inbox');
  ok(inbox[0] && !('contact_phone' in inbox[0]) && Number(inbox[0].approx_lat) === 4.05, 'inbox withholds phone and exact position');

  await as(newTechUser, `select * from public.register_technician($1::jsonb)`, [
    JSON.stringify({
      businessName: 'Garage Test',
      ownerName: 'Lionel Kotto',
      phone: '+237677000000',
      specialties: ['mechanic'],
      vehicleTypes: ['car'],
      location: { lat: 4.06, lng: 9.76 },
      area: 'Beedi',
      city: 'Douala',
      corridors: [],
      serviceRadiusKm: 10,
      mobileService: true,
      hasTowTruck: false,
    }),
  ]);
  const newTech = await as(newTechUser, `select * from public.get_my_technician()`);
  ok(newTech.length === 1 && newTech[0]!.verification_status === 'pending', 'technicians self-register as pending');
  ok((await as(newTechUser, `select role from public.profiles`))[0]!.role === 'technician', 'registering grants the technician role');
  ok((await as(newTechUser, `select * from public.technician_inbox()`)).length === 0, 'unverified technicians receive nothing');
  await expectError(newTechUser, `select public.accept_service_request($1)`, [req!.id], /ONYX:forbidden/, 'unverified technicians cannot accept');
  await expectError(driverA, `select public.accept_service_request($1)`, [req!.id], /ONYX:forbidden/, 'drivers cannot accept');

  await as(techUser, `select public.accept_service_request($1)`, [req!.id]);
  const accepted = await as(driverA, `select status, technician_id from public.service_requests where id = $1`, [req!.id]);
  ok(accepted[0]!.status === 'accepted' && accepted[0]!.technician_id === TECH1, 'technician accepts');
  ok((await as(techUser, `select count(*)::int as n from public.service_requests`))[0]!.n === 1, 'now the technician can read it');
  ok((await as(null, `select availability from public.technicians where id = $1`, [TECH1]))[0]!.availability === 'busy', 'accepting marks the technician busy');
  await expectError(techUser, `select public.accept_service_request($1)`, [req!.id], /ONYX:conflict/, 'a request cannot be accepted twice');
  await expectError(techUser, `select public.advance_service_request($1, 'arrived')`, [req!.id], /ONYX:invalid_transition/, 'steps cannot be skipped');
  await expectError(driverA, `select public.advance_service_request($1, 'en_route')`, [req!.id], /ONYX:forbidden/, 'drivers cannot move the job forward');

  await as(techUser, `select public.update_job_location($1, 4.05, 9.70)`, [req!.id]);
  await as(techUser, `select public.advance_service_request($1, 'en_route')`, [req!.id]);
  const live = await as(driverA, `select technician_lat from public.service_requests where id = $1`, [req!.id]);
  ok(Number(live[0]!.technician_lat) === 4.05, 'driver sees the shared position while en route');
  await as(techUser, `select public.advance_service_request($1, 'arrived')`, [req!.id]);
  await as(techUser, `select public.save_diagnosis($1, 'Batterie HS')`, [req!.id]);

  const items = JSON.stringify([
    { label: 'Batterie 70 Ah', kind: 'part', quantity: 1, unitPrice: 55000, total: 1 },
    { label: 'Pose', kind: 'labour', quantity: 2, unitPrice: 1500 },
  ]);
  const [quote1] = await as(techUser, `select * from public.send_quote($1, $2::jsonb, 'Garantie 6 mois')`, [req!.id, items]);
  ok(quote1!.total === 58000, `quote totals are computed by the database (${quote1!.total} FCFA)`);
  await expectError(techUser, `select * from public.send_quote($1, $2::jsonb)`, [req!.id, JSON.stringify([{ label: 'x', kind: 'gift', quantity: 1, unitPrice: 10 }])], /ONYX:validation/, 'invalid quote lines are rejected');
  await expectError(driverB, `select public.respond_to_quote($1, true)`, [quote1!.id], /ONYX:forbidden/, "other drivers can't answer the quote");
  await as(driverA, `select public.respond_to_quote($1, false)`, [quote1!.id]);
  ok((await as(driverA, `select status from public.service_requests where id = $1`, [req!.id]))[0]!.status === 'arrived', 'declining a quote sends the job back to "on site"');
  const [quote2] = await as(techUser, `select * from public.send_quote($1, $2::jsonb)`, [req!.id, JSON.stringify([{ label: 'Batterie 70 Ah', kind: 'part', quantity: 1, unitPrice: 52000 }])]);
  await as(driverA, `select public.respond_to_quote($1, true)`, [quote2!.id]);
  ok((await as(driverA, `select status from public.service_requests where id = $1`, [req!.id]))[0]!.status === 'in_progress', 'accepting the quote starts the work');
  const quotes = await as(driverA, `select status from public.quotes where request_id = $1 order by created_at`, [req!.id]);
  ok(quotes.map((q) => q.status).join(',') === 'declined,accepted', 'quote history is kept');

  await as(techUser, `select public.complete_service_request($1, 'mtn_momo', 52000)`, [req!.id]);
  const pay = await as(driverA, `select amount, commission, method, status from public.payments`);
  ok(pay.length === 1 && pay[0]!.commission === 5200 && pay[0]!.status === 'paid', 'completion records the payment and 10% commission');
  ok((await as(driverB, `select count(*)::int as n from public.payments`))[0]!.n === 0, "payments are private");
  ok((await as(null, `select availability from public.technicians where id = $1`, [TECH1]))[0]!.availability === 'available', 'technician is available again');

  const before = (await as(null, `select rating_avg, rating_count from public.technicians where id = $1`, [TECH1]))[0]!;
  await as(driverA, `select public.submit_review($1, 4, 'Rapide et propre', array['punctual','fair_price'])`, [req!.id]);
  const after = (await as(null, `select rating_avg, rating_count from public.technicians where id = $1`, [TECH1]))[0]!;
  ok(after.rating_count === before.rating_count + 1, `rating updated (${before.rating_avg} → ${after.rating_avg})`);
  const pub = await as(null, `select reviewer_name, rating from public.reviews where request_id = $1`, [req!.id]);
  ok(pub[0]!.reviewer_name === 'Arielle E.', 'public reviews show "First L." only');
  await expectError(driverA, `select public.submit_review($1, 5)`, [req!.id], /ONYX:conflict/, 'one review per job');
  const events = await as(driverA, `select type from public.request_events where request_id = $1 order by id`, [req!.id]);
  ok(events.length >= 10 && events[0]!.type === 'created' && events.at(-1)!.type === 'reviewed', `full history is recorded (${events.length} events)`);
  ok((await as(driverB, `select count(*)::int as n from public.request_events`))[0]!.n === 0, "other drivers can't read the history");

  console.log('\nBroadcast requests');
  const [b1] = await as(driverB, createRequestSql, ['flat_tire', 4.0555, 9.7031, null]);
  let techInbox = await as(techUser, `select id, is_direct from public.technician_inbox()`);
  ok(techInbox.some((r) => r.id === b1!.id && r.is_direct === false), 'nearby available technicians see broadcast requests');
  await as(techUser, `select public.decline_service_request($1)`, [b1!.id]);
  techInbox = await as(techUser, `select id from public.technician_inbox()`);
  ok(!techInbox.some((r) => r.id === b1!.id), 'declined requests disappear from that inbox');
  await expectError(techUser, `select public.accept_service_request($1)`, [b1!.id], /ONYX:forbidden/, 'and cannot be accepted after declining');

  const [b2] = await as(driverB, createRequestSql, ['engine', 4.0555, 9.7031, null]);
  await expectError(driverB, createRequestSql, ['fuel', 4.0555, 9.7031, null], /ONYX:limit_reached/, 'drivers are limited to 2 open requests');
  await as(techUser, `select public.accept_service_request($1)`, [b2!.id]);
  await as(techUser, `select public.release_service_request($1, 'Pièce indisponible')`, [b2!.id]);
  const released = await as(driverB, `select status, technician_id from public.service_requests where id = $1`, [b2!.id]);
  ok(released[0]!.status === 'pending' && released[0]!.technician_id === null, 'a technician can withdraw; the request reopens');
  await as(driverB, `select public.cancel_service_request($1, 'Réglé')`, [b2!.id]);
  ok((await as(driverB, `select status, cancelled_by from public.service_requests where id = $1`, [b2!.id]))[0]!.cancelled_by === 'driver', 'drivers can cancel');
  await expectError(driverB, `select public.cancel_service_request($1, 'x')`, [b2!.id], /ONYX:invalid_transition/, 'a cancelled request stays cancelled');

  console.log('\nTechnician & admin tools');
  const stats = (await as(techUser, `select public.technician_stats() as s`))[0]!.s;
  ok(stats.jobsThisMonth === 1 && stats.revenueThisMonth === 52000 && stats.commissionDue === 5200, 'technician stats add up');
  await expectError(driverA, `select public.admin_metrics()`, [], /ONYX:forbidden/, 'non-admins cannot read metrics');
  const metrics = (await as(adminUser, `select public.admin_metrics() as m`))[0]!.m;
  ok(metrics.requests.last30d === 3 && metrics.requests.completed30d === 1 && metrics.daily.length === 14, 'admin metrics are computed');
  ok(metrics.revenue.gmv30d === 52000 && metrics.technicians.pending === 3, 'revenue and verification queue are counted');
  const queue = await as(adminUser, `select id, user_id from public.admin_technicians('pending')`);
  ok(queue.length === 3, 'admins list listings waiting for review (with private columns)');
  await expectError(adminUser, `select public.admin_set_verification($1, 'rejected')`, [PENDING_TECH], /ONYX:validation/, 'rejecting requires a reason');
  await as(adminUser, `select public.admin_set_verification($1, 'verified')`, [PENDING_TECH]);
  ok((await as(null, `select count(*)::int as n from public.technicians`))[0]!.n === 32, 'verified listings appear in the public directory');
  await expectError(techUser, `select public.admin_set_verification($1, 'verified')`, [PENDING_TECH], /ONYX:forbidden/, 'technicians cannot verify listings');
  const perf = await as(adminUser, `select * from public.admin_technician_performance()`);
  ok(perf[0]!.technician_id === TECH1 && Number(perf[0]!.revenue_30d) === 52000, 'performance ranks technicians by revenue');
  const payId = (await as(adminUser, `select id from public.payments`))[0]!.id;
  await as(adminUser, `select public.admin_settle_commission($1)`, [payId]);
  ok((await as(techUser, `select public.technician_stats() as s`))[0]!.s.commissionDue === 0, 'settling a commission clears what the technician owes');

  console.log('\nPhone alerts');
  const driverC = await createUser('awa@example.cm', 'Awa Ngo');
  const device = (n: number) => [`https://push.example.net/send/device-${n}`, 'B'.repeat(87), 'A'.repeat(22)];
  const lastEvent = async (requestId: string, type: string) =>
    (await asService(`select id from public.request_events where request_id = $1 and type = $2 order by id desc limit 1`, [requestId, type]))[0]!.id;
  const targets = async (requestId: string, type: string) => asService(`select * from public.push_targets($1)`, [await lastEvent(requestId, type)]);

  await as(driverC, `select public.save_push_subscription($1, $2, $3, 'en')`, device(1));
  await as(techUser, `select public.save_push_subscription($1, $2, $3, 'fr')`, device(2));
  await as(driverC, `select public.save_push_subscription($1, $2, $3, 'en')`, device(1));
  ok((await asService(`select count(*)::int as n from public.push_subscriptions`))[0]!.n === 2, 'saving the same device twice keeps one entry');
  await expectError(driverC, `select * from public.push_subscriptions`, [], /permission denied/, 'apps cannot read saved devices');
  await expectError(techUser, `select * from public.push_targets(1)`, [], /permission denied/, 'only the server can ask who to alert');
  await expectError(null, `select public.save_push_subscription($1, $2, $3)`, device(3), /permission denied/, 'visitors cannot save devices');
  await expectError(driverC, `select public.save_push_subscription('http://insecure.example/x', $1, $2)`, device(4).slice(1), /check constraint/, 'push addresses must be HTTPS');

  const techName = (await as(null, `select business_name from public.technicians where id = $1`, [TECH1]))[0]!.business_name;
  const [open] = await as(driverC, createRequestSql, ['flat_tire', 4.0531, 9.7002, null]);
  const offer = await targets(open!.id, 'created');
  ok(
    offer.length === 1 && offer[0]!.audience === 'technician' && offer[0]!.endpoint === device(2)[0] && offer[0]!.distance_km !== null,
    'an open request alerts technicians in range, not the driver who sent it',
  );
  await as(techUser, `select public.accept_service_request($1)`, [open!.id]);
  const acceptedAlert = await targets(open!.id, 'accepted');
  ok(
    acceptedAlert.length === 1 && acceptedAlert[0]!.audience === 'driver' && acceptedAlert[0]!.locale === 'en' && acceptedAlert[0]!.technician_name === techName,
    'the driver hears who accepted, in their language',
  );
  await as(driverC, `select public.cancel_service_request($1, 'Réparé seul')`, [open!.id]);
  const cancelAlert = await targets(open!.id, 'cancelled');
  ok(cancelAlert.length === 1 && cancelAlert[0]!.audience === 'technician', 'the technician hears when the driver cancels');

  const [direct] = await as(driverC, createRequestSql, ['battery', 4.0531, 9.7002, '00000000-0000-4000-8000-000000000002']);
  ok((await targets(direct!.id, 'created')).length === 0, 'a request addressed to one technician alerts nobody else');
  await as(driverC, `select public.cancel_service_request($1, 'Plus besoin')`, [direct!.id]);

  await as(driverA, `select public.save_push_subscription($1, $2, $3, 'fr')`, device(1));
  const moved = await asService(`select user_id from public.push_subscriptions where endpoint = $1`, [device(1)[0]]);
  ok(moved[0]!.user_id === driverA, 'a phone that changes hands alerts its new owner only');
  await as(driverA, `select public.delete_push_subscription($1)`, [device(1)[0]]);
  await as(driverC, `select public.delete_push_subscription($1)`, [device(2)[0]]);
  const left = await asService(`select endpoint from public.push_subscriptions`);
  ok(left.length === 1 && left[0]!.endpoint === device(2)[0], 'signing out forgets the device, and nobody can remove another person’s');

  console.log('\nContinue with Google');
  const googleUser = crypto.randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    googleUser,
    'awa.ngo@gmail.com',
    JSON.stringify({ name: 'Awa Ngo', locale: 'en-GB', avatar_url: 'https://lh3.googleusercontent.com/a/x', email_verified: true }),
  ]);
  const googleProfile = (await as(googleUser, `select full_name, locale, role, phone from public.profiles`))[0]!;
  ok(googleProfile.full_name === 'Awa Ngo' && googleProfile.locale === 'en' && googleProfile.role === 'driver' && googleProfile.phone === null, 'a Google account gets a profile with its name and language');

  console.log('\nAccount deletion');
  await expectError(null, `select public.delete_my_account()`, [], /permission denied/, 'visitors cannot call it');
  await expectError(adminUser, `select public.delete_my_account()`, [], /ONYX:forbidden/, 'ONYX team accounts are not deleted from the app');
  await expectError(driverB, `select public.delete_my_account(true)`, [], /ONYX:conflict/, 'an open request has to end first');

  const ratingBefore = (await as(null, `select rating_count, rating_avg from public.technicians where id = $1`, [TECH1]))[0]!;
  await as(driverA, `select public.delete_my_account(true)`);
  ok((await db.query<Row>(`select count(*)::int as n from auth.users where id = $1`, [driverA])).rows[0]!.n === 1, 'a dry run deletes nothing');
  await as(driverA, `select public.save_push_subscription($1, $2, $3)`, device(5));
  await as(driverA, `select public.delete_my_account()`);
  ok((await db.query<Row>(`select count(*)::int as n from auth.users where id = $1`, [driverA])).rows[0]!.n === 0, 'the driver’s sign-in account is gone');
  ok((await asService(`select count(*)::int as n from public.profiles where id = $1`, [driverA]))[0]!.n === 0, 'and their profile');
  ok((await asService(`select count(*)::int as n from public.push_subscriptions where endpoint = $1`, [device(5)[0]]))[0]!.n === 0, 'and the phones saved for alerts');
  const kept = (await asService(`select * from public.service_requests where id = $1`, [req!.id]))[0]!;
  ok(
    kept && kept.driver_id === null && kept.contact_phone === null && kept.contact_name === 'Compte supprimé' && JSON.stringify(kept.vehicle) === '{"type":"car"}',
    'a completed job stays, without the driver’s name, phone or vehicle',
  );
  ok(Number(kept.lat) === Math.round(Number(kept.lat) * 100) / 100, 'its position is blurred to about a kilometre');
  const payment = (await asService(`select amount, driver_id from public.payments where request_id = $1`, [req!.id]))[0]!;
  ok(payment.amount === 52000 && payment.driver_id === null, 'its payment stays for the commission accounting');
  const review = (await asService(`select rating, reviewer_name, comment from public.reviews where request_id = $1`, [req!.id]))[0]!;
  ok(review.rating === 4 && review.reviewer_name === '' && review.comment === null, 'the review keeps its rating but loses the name and words');
  const ratingAfter = (await as(null, `select rating_count, rating_avg from public.technicians where id = $1`, [TECH1]))[0]!;
  ok(ratingAfter.rating_count === ratingBefore.rating_count && Number(ratingAfter.rating_avg) === Number(ratingBefore.rating_avg), 'the technician’s rating is unchanged');
  const history = await as(techUser, `select contact_phone from public.service_requests where id = $1`, [req!.id]);
  ok(history.length === 1 && history[0]!.contact_phone === null, 'the technician still sees the job in their history');

  const listingId = (await asService(`select id from public.technicians where user_id = $1`, [newTechUser]))[0]!.id;
  await as(newTechUser, `select public.delete_my_account()`);
  const listing = (await asService(`select * from public.technicians where id = $1`, [listingId]))[0]!;
  ok(
    listing.user_id === null && listing.phone === null && listing.owner_name === 'Compte supprimé' && listing.verification_status === 'suspended',
    'a technician’s listing loses its owner, phone and name and leaves the directory',
  );
  ok((await as(null, `select count(*)::int as n from public.technicians where id = $1`, [listingId]))[0]!.n === 0, 'nobody can find it any more');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
