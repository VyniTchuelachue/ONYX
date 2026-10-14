-- Account deletion, required by Google Play and the App Store.
--
-- What goes: the sign-in account and profile, devices saved for alerts, requests that never
-- completed, and every name, phone number, exact position, vehicle and comment the person
-- left. For a technician: the public listing's details and the verification documents (the
-- files themselves are removed through the Storage API by the app, before this runs).
-- What stays, anonymised: completed jobs and their payments (the technician's history and
-- ONYX's commission accounting) and review ratings (technicians keep a fair average).

alter table public.service_requests alter column driver_id drop not null;
alter table public.service_requests drop constraint service_requests_driver_id_fkey;
alter table public.service_requests
  add constraint service_requests_driver_id_fkey foreign key (driver_id) references auth.users (id) on delete set null;
alter table public.service_requests alter column contact_phone drop not null;
alter table public.technicians alter column phone drop not null;

-- With p_dry_run, only checks that nothing stands in the way (the app asks before removing
-- the documents, which cannot be restored).
create or replace function public.delete_my_account(p_dry_run boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tech public.technicians;
begin
  if v_uid is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  -- ONYX team accounts are removed by another admin, never from the app.
  if public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;
  select * into v_tech from public.technicians where user_id = v_uid for update;

  -- Someone may be on the way or working on the car: that job has to end first.
  if exists (
    select 1 from public.service_requests r
     where r.status not in ('completed', 'cancelled')
       and (r.driver_id = v_uid or (v_tech.id is not null and r.technician_id = v_tech.id))
  ) then
    raise exception 'ONYX:conflict';
  end if;
  if p_dry_run then
    return;
  end if;

  -- Requests that never completed carry no payment: they go entirely.
  delete from public.service_requests where driver_id = v_uid and status <> 'completed';

  -- Completed jobs stay for the technician's history and the commission accounting.
  update public.service_requests
     set driver_id = null,
         contact_name = 'Compte supprimé',
         contact_phone = null,
         description = '',
         ai_summary = null,
         -- The vehicle type (car, motorbike…) isn't personal; make, model and plate are.
         vehicle = case when vehicle ? 'type' then jsonb_build_object('type', vehicle -> 'type') else '{}'::jsonb end,
         landmark = 'Compte supprimé',
         lat = round(lat::numeric, 2)::double precision,
         lng = round(lng::numeric, 2)::double precision,
         cancel_reason = null
   where driver_id = v_uid;

  -- Ratings keep counting for the technician; the reviewer's name and words go.
  update public.reviews set reviewer_name = '', comment = null where driver_id = v_uid;

  if v_tech.id is not null then
    delete from public.technician_documents where technician_id = v_tech.id;
    update public.technicians
       set user_id = null,
           business_name = 'Compte supprimé',
           owner_name = 'Compte supprimé',
           bio = null,
           phone = null,
           whatsapp = null,
           address = null,
           photo_url = null,
           opening_hours = null,
           years_experience = null,
           lat = round(lat::numeric, 2)::double precision,
           lng = round(lng::numeric, 2)::double precision,
           verification_status = 'suspended',
           verification_note = 'Compte supprimé par son titulaire.',
           availability = 'offline'
     where id = v_tech.id;
  end if;

  -- The profile and saved devices go with the sign-in account (foreign keys cascade).
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account(boolean) from public, anon, authenticated;
grant execute on function public.delete_my_account(boolean) to authenticated;
