-- Row level security and privileges.
--
-- Principles:
--   • Clients only ever READ tables directly. Every write goes through a function in
--     *_functions.sql, which checks who is calling and whether the change is allowed.
--   • Exceptions: a user may edit a few columns of their own profile, and a technician
--     may attach verification documents to their own listing.
--   • Private technician columns (account link, admin notes) are hidden with column
--     privileges; owners and admins read them through get_my_technician()/admin_technicians().

alter table public.profiles enable row level security;
alter table public.technicians enable row level security;
alter table public.technician_documents enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_events enable row level security;
alter table public.request_declines enable row level security;
alter table public.quotes enable row level security;
alter table public.reviews enable row level security;
alter table public.payments enable row level security;

-- Start from nothing, then grant precisely.
revoke all on
  public.profiles, public.technicians, public.technician_documents, public.service_requests,
  public.request_events, public.request_declines, public.quotes, public.reviews, public.payments
from anon, authenticated;

-- ── profiles ──────────────────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (full_name, phone, locale, default_vehicle) on public.profiles to authenticated;

create policy "Users read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── technicians (public directory) ───────────────────────────────────────────
grant select (
  id, business_name, owner_name, bio, phone, whatsapp, specialties, vehicle_types, lat, lng, address,
  area, city, corridors, service_radius_km, mobile_service, has_tow_truck, opening_hours,
  years_experience, photo_url, verification_status, availability, availability_updated_at,
  last_seen_at, rating_avg, rating_count, jobs_completed, avg_response_minutes, created_at
) on public.technicians to anon, authenticated;

create policy "Anyone reads verified technicians" on public.technicians
  for select to anon, authenticated
  using (verification_status = 'verified');

create policy "Technicians read their own listing" on public.technicians
  for select to authenticated
  using (id = (select public.my_technician_id()));

create policy "Drivers read technicians on their requests" on public.technicians
  for select to authenticated
  using (exists (
    select 1 from public.service_requests r
     where r.driver_id = (select auth.uid())
       and (r.technician_id = technicians.id or r.requested_technician_id = technicians.id)
  ));

create policy "Admins read every technician" on public.technicians
  for select to authenticated
  using ((select public.is_admin()));

-- ── technician documents (private) ───────────────────────────────────────────
grant select, delete on public.technician_documents to authenticated;
grant insert (technician_id, kind, file_name, storage_path) on public.technician_documents to authenticated;

create policy "Technicians read their documents" on public.technician_documents
  for select to authenticated
  using (technician_id = (select public.my_technician_id()) or (select public.is_admin()));

create policy "Technicians add their documents" on public.technician_documents
  for insert to authenticated
  with check (
    technician_id = (select public.my_technician_id())
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "Technicians remove their documents" on public.technician_documents
  for delete to authenticated
  using (technician_id = (select public.my_technician_id()));

-- ── service requests ─────────────────────────────────────────────────────────
grant select on public.service_requests to authenticated;

create policy "Drivers read their requests" on public.service_requests
  for select to authenticated
  using (driver_id = (select auth.uid()));

create policy "Technicians read requests assigned to them" on public.service_requests
  for select to authenticated
  using (technician_id is not null and technician_id = (select public.my_technician_id()));

create policy "Admins read every request" on public.service_requests
  for select to authenticated
  using ((select public.is_admin()));

-- ── request events & quotes: visible with their request ─────────────────────
grant select on public.request_events, public.quotes to authenticated;

create policy "Read events of visible requests" on public.request_events
  for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_events.request_id));

create policy "Read quotes of visible requests" on public.quotes
  for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = quotes.request_id));

-- request_declines: functions only (no policy → no direct access).

-- ── reviews: public, without the reviewer's account id ───────────────────────
grant select (id, request_id, technician_id, reviewer_name, rating, comment, tags, created_at)
  on public.reviews to anon, authenticated;

create policy "Anyone reads reviews" on public.reviews
  for select to anon, authenticated
  using (true);

-- ── payments ─────────────────────────────────────────────────────────────────
grant select on public.payments to authenticated;

create policy "Drivers read their payments" on public.payments
  for select to authenticated
  using (driver_id = (select auth.uid()));

create policy "Technicians read their payments" on public.payments
  for select to authenticated
  using (technician_id = (select public.my_technician_id()));

create policy "Admins read every payment" on public.payments
  for select to authenticated
  using ((select public.is_admin()));

-- ── functions ────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside policies, so callers need them.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_technician_id() to anon, authenticated;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision)
  to anon, authenticated;

-- Public API
grant execute on function public.nearby_technicians(
  double precision, double precision, double precision, text, boolean, text, integer
) to anon, authenticated;

-- Signed-in API
grant execute on function
  public.create_service_request(text, text, public.urgency_level, text, jsonb, double precision, double precision, text, text, text, text, uuid),
  public.cancel_service_request(uuid, text),
  public.respond_to_quote(uuid, boolean),
  public.submit_review(uuid, integer, text, text[]),
  public.get_my_technician(),
  public.register_technician(jsonb),
  public.update_my_technician(jsonb),
  public.set_my_availability(public.availability_status),
  public.technician_heartbeat(),
  public.technician_inbox(),
  public.accept_service_request(uuid),
  public.decline_service_request(uuid),
  public.release_service_request(uuid, text),
  public.advance_service_request(uuid, public.request_status),
  public.save_diagnosis(uuid, text),
  public.send_quote(uuid, jsonb, text),
  public.complete_service_request(uuid, public.payment_method, integer),
  public.update_job_location(uuid, double precision, double precision),
  public.technician_stats(),
  public.admin_technicians(public.verification_status, uuid),
  public.admin_set_verification(uuid, public.verification_status, text),
  public.admin_settle_commission(uuid),
  public.admin_metrics(),
  public.admin_technician_performance(uuid)
to authenticated;
