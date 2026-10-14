# ONYX

Roadside assistance for Douala and Cameroon's intercity roads: drivers describe a problem,
get safe first steps, and reach verified mechanics, auto electricians, tyre repairers and
tow trucks — even offline.

## Structure

```
apps/web/          Next.js 16 (App Router, TypeScript, Tailwind CSS v4) — web app + /api/v1
packages/core/     Shared by web and the future React Native app:
                   types, zod schemas, FR/EN dictionaries, request lifecycle, geo,
                   offline triage guide, and the backend contract with two adapters
                   (Supabase for production, an on-device demo backend)
supabase/          SQL migrations (schema, business rules as RPC functions, RLS,
                   Realtime, Storage) + generated seed data
scripts/           seed generator, database test suite (embedded Postgres), icon generator
```

All business rules live in Postgres functions guarded by row-level security, so any
client (web today, React Native tomorrow) gets the same guarantees by calling Supabase
directly. The only server route is the AI assistant (`POST /api/v1/assistant`), which
accepts a Supabase bearer token so mobile can use it unchanged.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment variables the app runs in **demo mode** (fictional data stored in the
browser; seeded technicians accept and progress requests on their own). To use Supabase,
copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in.

### Supabase setup

1. Create a project, then apply `supabase/migrations/*.sql` in order (SQL editor, or
   `npx supabase link` + `npx supabase db push`).
2. Optional development data: run `supabase/seed.sql` (regenerate with `npm run db:seed`).
3. Make yourself an admin:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. Sign-up confirmations and password resets are emailed by Supabase Auth:
   - Authentication → URL Configuration: set the Site URL to your domain and add
     `https://your-domain/**` to the Redirect URLs (the links come back to
     `/auth/sign-in` and `/auth/reset-password`).
   - Authentication → SMTP: connect your own sender (Resend, Brevo…). Supabase's built-in
     sender is for testing only: a few emails per hour, and only to your team's addresses.

### Checks

```bash
npm test           # core unit tests (52): rules, triage, i18n parity, alerts, demo job flow
npm run db:test    # 73 checks: migrations + RLS + job lifecycle + alert targeting in embedded Postgres
npm run typecheck
```

## AI assistant

`ANTHROPIC_API_KEY` enables Claude (`claude-opus-5-5` by default, effort `low`, structured
output, prompt caching, server-side refusal fallback). Set `ANTHROPIC_MODEL=claude-haiku-5-5`
for roughly 40× lower cost per message. Without a key, or offline, the built-in FR/EN
safety guide answers instead.

## Phone alerts

Technicians get each new request near them, and drivers each step of their job (accepted,
on the way, arrived, quote, done), even with ONYX closed. They turn alerts on from the
dashboard, their profile, or the tracking page. How it works: the database logs every step
of a job; a trigger asks `POST /api/v1/push/dispatch` to send alerts; that route asks the
database who should hear about it (`push_targets()`, same rules as the technician inbox),
words each alert in the person's language and sends it with Web Push. Free: no SMS, no
third-party service.

To switch it on:

1. Create keys: `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_HOOK_SECRET` and `SUPABASE_SECRET_KEY`
   (see `apps/web/.env.example`).
2. Tell the database where to send, in the Supabase SQL editor:
   ```sql
   select vault.create_secret('https://your-domain/api/v1/push/dispatch', 'onyx_push_hook_url');
   select vault.create_secret('<same value as PUSH_HOOK_SECRET>', 'onyx_push_hook_secret');
   ```
   The migration enables `pg_net`; if your project refuses, enable it under Database → Extensions.
3. Deploy, then check `/api/v1/health` reports `"alerts": "on"`.

Alerts need the production build (they arrive through the service worker). Android and
desktop browsers support them; on iPhone (iOS 16.4+) people must first add ONYX to the
Home Screen. In demo mode there is no server, so the page shows alerts itself while it
stays open in the background.

## Screens

| Area | Routes |
|---|---|
| Driver | `/` home, `/assistant` (text or voice), `/technicians` list + map, `/technicians/[id]`, `/request/new` wizard, `/requests` + `/requests/[id]` live tracking, quotes, payment and review, `/offline`, `/profile` |
| Technician | `/pro` dashboard + inbox, `/pro/jobs` + `/pro/jobs/[id]` (status, diagnosis, quote, completion), `/pro/onboarding`, `/pro/profile` (listing + verification documents) |
| Admin | `/admin` overview, `/admin/technicians` verification, `/admin/requests`, `/admin/payments` (commissions), `/admin/quality` (ratings, performance) |
| Account | `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/reset-password`, `/demo` role picker |

The service worker (`public/sw.js`) only registers in production builds (`npm run build`
then `npm start`).

## Try it on a phone

- Same Wi-Fi: run `npm run dev`, then open `http://<your-computer's-IP>:3000` on the phone.
  GPS and voice need HTTPS outside localhost, so on the phone pick your neighbourhood instead.
- Deployed (e.g. Vercel, root directory `apps/web`): open the URL and use the browser's
  "Add to Home screen" to install ONYX like an app, with offline support.

## Before launch

- Supabase project with the migrations applied (above), and email templates in French.
- A keyed map tile provider (see `.env.example`): OpenStreetMap's own tiles are for light use.
- `ANTHROPIC_API_KEY`, with the model chosen for your budget (see AI assistant).
- Phone alerts keys and database secrets (see Phone alerts).
- Not built yet: SMS alerts, mobile-money payment (payments are recorded, not processed),
  the React Native app (it can reuse `packages/core` and the same backend).
