-- Business rules. Every state change goes through one of these functions so that
-- web and mobile clients share exactly the same guarantees. Errors are raised as
-- `ONYX:<code>`; clients map the code to a translated message.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_technician_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.technicians where user_id = auth.uid();
$$;

create or replace function public.distance_km(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371.0088 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- Mirrors COMMISSION_RATE in packages/core/src/constants.ts.
create or replace function public.platform_commission_rate()
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 0.10::numeric;
$$;

-- Mirrors the transition table in packages/core/src/domain/status.ts.
create or replace function public.can_transition(
  p_from public.request_status, p_to public.request_status, p_actor public.user_role
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_actor
    when 'technician' then (p_from::text, p_to::text) in (
      ('pending', 'accepted'),
      ('accepted', 'en_route'), ('accepted', 'pending'), ('accepted', 'cancelled'),
      ('en_route', 'arrived'), ('en_route', 'pending'), ('en_route', 'cancelled'),
      ('arrived', 'quoted'), ('arrived', 'in_progress'), ('arrived', 'cancelled'),
      ('quoted', 'quoted'), ('quoted', 'cancelled'),
      ('in_progress', 'completed')
    )
    when 'driver' then (p_from::text, p_to::text) in (
      ('pending', 'cancelled'), ('accepted', 'cancelled'), ('en_route', 'cancelled'),
      ('arrived', 'cancelled'), ('quoted', 'in_progress'), ('quoted', 'arrived'), ('quoted', 'cancelled')
    )
    when 'admin' then p_to = 'cancelled' and p_from not in ('completed', 'cancelled')
    else false
  end;
$$;

create or replace function public.log_request_event(
  p_request_id uuid, p_type text, p_role public.user_role, p_data jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.request_events (request_id, type, actor_id, actor_role, data)
  values (p_request_id, p_type, auth.uid(), p_role, p_data);
$$;

-- A technician with no other active job goes back to "available" after a job ends.
create or replace function public.free_up_technician(p_technician_id uuid, p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.technicians t
     set availability = 'available'
   where t.id = p_technician_id
     and t.availability = 'busy'
     and not exists (
       select 1 from public.service_requests r
        where r.technician_id = p_technician_id
          and r.id <> p_request_id
          and r.status not in ('completed', 'cancelled')
     );
$$;

-- The signed-in technician's listing, locked for update. Raises when there is none.
create or replace function public.require_my_technician(p_must_be_verified boolean default true)
returns public.technicians
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians;
begin
  if auth.uid() is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  select * into v_tech from public.technicians where user_id = auth.uid() for update;
  if not found then
    raise exception 'ONYX:forbidden';
  end if;
  if p_must_be_verified and v_tech.verification_status <> 'verified' then
    raise exception 'ONYX:forbidden';
  end if;
  return v_tech;
end;
$$;

-- The request, locked, after checking the signed-in technician is assigned to it.
create or replace function public.require_assigned_request(p_request_id uuid, p_technician_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
  if v_req.technician_id is distinct from p_technician_id then
    raise exception 'ONYX:forbidden';
  end if;
  return v_req;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Discovery (public)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.nearby_technicians(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_specialty text default null,
  p_available_only boolean default false,
  p_corridor text default null,
  p_limit integer default 60
)
returns table (
  id uuid,
  business_name text,
  owner_name text,
  bio text,
  phone text,
  whatsapp text,
  specialties text[],
  vehicle_types text[],
  lat double precision,
  lng double precision,
  address text,
  area text,
  city text,
  corridors text[],
  service_radius_km integer,
  mobile_service boolean,
  has_tow_truck boolean,
  opening_hours text,
  years_experience integer,
  photo_url text,
  verification_status public.verification_status,
  availability public.availability_status,
  availability_updated_at timestamptz,
  last_seen_at timestamptz,
  rating_avg numeric,
  rating_count integer,
  jobs_completed integer,
  avg_response_minutes integer,
  created_at timestamptz,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      least(greatest(coalesce(p_radius_km, 15), 1), 400) as radius,
      least(greatest(coalesce(p_radius_km, 15), 1), 400) / 111.32 as dlat,
      least(greatest(coalesce(p_radius_km, 15), 1), 400) / (111.32 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select
    t.id, t.business_name, t.owner_name, t.bio, t.phone, t.whatsapp, t.specialties, t.vehicle_types,
    t.lat, t.lng, t.address, t.area, t.city, t.corridors, t.service_radius_km, t.mobile_service,
    t.has_tow_truck, t.opening_hours, t.years_experience, t.photo_url, t.verification_status,
    t.availability, t.availability_updated_at, t.last_seen_at, t.rating_avg, t.rating_count,
    t.jobs_completed, t.avg_response_minutes, t.created_at,
    public.distance_km(p_lat, p_lng, t.lat, t.lng) as distance_km
  from public.technicians t, params
  where t.verification_status = 'verified'
    and (p_specialty is null or p_specialty = any (t.specialties))
    and (
      not coalesce(p_available_only, false)
      or (t.availability = 'available'
          and coalesce(t.last_seen_at, t.availability_updated_at) > now() - interval '6 hours')
    )
    and (
      (p_corridor is not null and p_corridor = any (t.corridors))
      or (
        p_corridor is null
        and t.lat between p_lat - params.dlat and p_lat + params.dlat
        and t.lng between p_lng - params.dlng and p_lng + params.dlng
        and public.distance_km(p_lat, p_lng, t.lat, t.lng) <= params.radius
      )
    )
  order by distance_km
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Drivers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_service_request(
  p_category text,
  p_description text,
  p_urgency public.urgency_level,
  p_ai_summary text,
  p_vehicle jsonb,
  p_lat double precision,
  p_lng double precision,
  p_landmark text,
  p_place_label text,
  p_contact_name text,
  p_contact_phone text,
  p_requested_technician_id uuid default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.service_requests;
  v_active integer;
begin
  if v_uid is null then
    raise exception 'ONYX:unauthenticated';
  end if;

  -- Mirrors MAX_ACTIVE_REQUESTS_PER_DRIVER.
  select count(*) into v_active
    from public.service_requests
   where driver_id = v_uid and status not in ('completed', 'cancelled');
  if v_active >= 2 then
    raise exception 'ONYX:limit_reached';
  end if;

  if p_requested_technician_id is not null and not exists (
    select 1 from public.technicians where id = p_requested_technician_id and verification_status = 'verified'
  ) then
    raise exception 'ONYX:not_found';
  end if;

  if p_vehicle is not null and (jsonb_typeof(p_vehicle) <> 'object' or octet_length(p_vehicle::text) > 1000) then
    raise exception 'ONYX:validation';
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.service_requests (
        code, driver_id, contact_name, contact_phone, requested_technician_id, category, description,
        urgency, ai_summary, vehicle, lat, lng, landmark, place_label
      ) values (
        public.generate_request_code(), v_uid, btrim(p_contact_name), p_contact_phone, p_requested_technician_id,
        p_category, coalesce(btrim(p_description), ''), coalesce(p_urgency, 'medium'),
        nullif(btrim(p_ai_summary), ''), coalesce(p_vehicle, '{}'::jsonb), p_lat, p_lng, btrim(p_landmark),
        nullif(btrim(p_place_label), '')
      )
      returning * into v_row;
      exit;
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  perform public.log_request_event(v_row.id, 'created', 'driver');
  return v_row;
end;
$$;

create or replace function public.cancel_service_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_role public.user_role;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if v_uid is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'ONYX:not_found';
  end if;

  if v_req.driver_id = v_uid then
    v_role := 'driver';
  elsif v_req.technician_id is not null and v_req.technician_id = public.my_technician_id() then
    v_role := 'technician';
  elsif public.is_admin() then
    v_role := 'admin';
  else
    raise exception 'ONYX:forbidden';
  end if;

  if not public.can_transition(v_req.status, 'cancelled', v_role) then
    raise exception 'ONYX:invalid_transition';
  end if;

  update public.service_requests
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_role, cancel_reason = nullif(v_reason, ''),
         technician_lat = null, technician_lng = null, technician_location_at = null
   where id = p_request_id;

  if v_req.technician_id is not null then
    perform public.free_up_technician(v_req.technician_id, p_request_id);
  end if;
  perform public.log_request_event(p_request_id, 'cancelled', v_role, jsonb_build_object('reason', nullif(v_reason, '')));
end;
$$;

create or replace function public.respond_to_quote(p_quote_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_req public.service_requests;
begin
  if auth.uid() is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
  select * into v_req from public.service_requests where id = v_quote.request_id for update;
  if v_req.driver_id <> auth.uid() then
    raise exception 'ONYX:forbidden';
  end if;
  if v_quote.status <> 'pending' or v_req.status <> 'quoted' then
    raise exception 'ONYX:invalid_transition';
  end if;

  update public.quotes
     set status = case when p_accept then 'accepted'::public.quote_status else 'declined'::public.quote_status end,
         responded_at = now()
   where id = p_quote_id;

  if p_accept then
    update public.service_requests set status = 'in_progress', started_at = now() where id = v_req.id;
    perform public.log_request_event(v_req.id, 'quote_accepted', 'driver', jsonb_build_object('total', v_quote.total));
  else
    update public.service_requests set status = 'arrived' where id = v_req.id;
    perform public.log_request_event(v_req.id, 'quote_declined', 'driver', jsonb_build_object('total', v_quote.total));
  end if;
end;
$$;

create or replace function public.submit_review(
  p_request_id uuid, p_rating integer, p_comment text default null, p_tags text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests;
  v_name text;
  v_parts text[];
begin
  if auth.uid() is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'ONYX:validation';
  end if;
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.driver_id <> auth.uid() then
    raise exception 'ONYX:not_found';
  end if;
  if v_req.status <> 'completed' or v_req.technician_id is null then
    raise exception 'ONYX:invalid_transition';
  end if;
  if exists (select 1 from public.reviews where request_id = p_request_id) then
    raise exception 'ONYX:conflict';
  end if;

  -- Public reviews show "First L." only.
  select regexp_split_to_array(btrim(full_name), '\s+') into v_parts from public.profiles where id = auth.uid();
  v_name := case
    when v_parts is null or v_parts[1] = '' then ''
    when cardinality(v_parts) = 1 then v_parts[1]
    else v_parts[1] || ' ' || left(v_parts[cardinality(v_parts)], 1) || '.'
  end;

  insert into public.reviews (request_id, technician_id, driver_id, reviewer_name, rating, comment, tags)
  values (
    p_request_id, v_req.technician_id, auth.uid(), left(v_name, 60), p_rating,
    nullif(left(btrim(coalesce(p_comment, '')), 1000), ''), coalesce(p_tags, '{}')
  );

  update public.technicians
     set rating_avg = round((rating_avg * rating_count + p_rating)::numeric / (rating_count + 1), 2),
         rating_count = rating_count + 1
   where id = v_req.technician_id;

  perform public.log_request_event(p_request_id, 'reviewed', 'driver', jsonb_build_object('rating', p_rating));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Technicians
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_technician()
returns setof public.technicians
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.technicians where user_id = auth.uid();
$$;

create or replace function public.register_technician(p_data jsonb)
returns public.technicians
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.technicians;
begin
  if v_uid is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  if exists (select 1 from public.technicians where user_id = v_uid) then
    raise exception 'ONYX:conflict';
  end if;

  insert into public.technicians (
    user_id, business_name, owner_name, bio, phone, whatsapp, specialties, vehicle_types, lat, lng,
    address, area, city, corridors, service_radius_km, mobile_service, has_tow_truck, opening_hours,
    years_experience, availability
  ) values (
    v_uid,
    btrim(p_data ->> 'businessName'),
    btrim(p_data ->> 'ownerName'),
    nullif(btrim(p_data ->> 'bio'), ''),
    p_data ->> 'phone',
    nullif(p_data ->> 'whatsapp', ''),
    array(select jsonb_array_elements_text(p_data -> 'specialties')),
    array(select jsonb_array_elements_text(p_data -> 'vehicleTypes')),
    (p_data -> 'location' ->> 'lat')::double precision,
    (p_data -> 'location' ->> 'lng')::double precision,
    nullif(btrim(p_data ->> 'address'), ''),
    coalesce(btrim(p_data ->> 'area'), ''),
    coalesce(nullif(btrim(p_data ->> 'city'), ''), 'Douala'),
    array(select jsonb_array_elements_text(coalesce(p_data -> 'corridors', '[]'::jsonb))),
    coalesce((p_data ->> 'serviceRadiusKm')::integer, 15),
    coalesce((p_data ->> 'mobileService')::boolean, true),
    coalesce((p_data ->> 'hasTowTruck')::boolean, false),
    nullif(btrim(p_data ->> 'openingHours'), ''),
    (p_data ->> 'yearsExperience')::integer,
    'offline'
  )
  returning * into v_row;

  update public.profiles set role = 'technician' where id = v_uid and role = 'driver';
  return v_row;
end;
$$;

create or replace function public.update_my_technician(p_data jsonb)
returns public.technicians
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_row public.technicians;
begin
  update public.technicians set
    business_name = btrim(p_data ->> 'businessName'),
    owner_name = btrim(p_data ->> 'ownerName'),
    bio = nullif(btrim(p_data ->> 'bio'), ''),
    phone = p_data ->> 'phone',
    whatsapp = nullif(p_data ->> 'whatsapp', ''),
    specialties = array(select jsonb_array_elements_text(p_data -> 'specialties')),
    vehicle_types = array(select jsonb_array_elements_text(p_data -> 'vehicleTypes')),
    lat = (p_data -> 'location' ->> 'lat')::double precision,
    lng = (p_data -> 'location' ->> 'lng')::double precision,
    address = nullif(btrim(p_data ->> 'address'), ''),
    area = coalesce(btrim(p_data ->> 'area'), ''),
    city = coalesce(nullif(btrim(p_data ->> 'city'), ''), 'Douala'),
    corridors = array(select jsonb_array_elements_text(coalesce(p_data -> 'corridors', '[]'::jsonb))),
    service_radius_km = coalesce((p_data ->> 'serviceRadiusKm')::integer, service_radius_km),
    mobile_service = coalesce((p_data ->> 'mobileService')::boolean, mobile_service),
    has_tow_truck = coalesce((p_data ->> 'hasTowTruck')::boolean, has_tow_truck),
    opening_hours = nullif(btrim(p_data ->> 'openingHours'), ''),
    years_experience = (p_data ->> 'yearsExperience')::integer
  where id = v_tech.id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_my_availability(p_availability public.availability_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
begin
  update public.technicians set availability = p_availability, last_seen_at = now() where id = v_tech.id;
end;
$$;

create or replace function public.technician_heartbeat()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.technicians set last_seen_at = now() where user_id = auth.uid();
$$;

-- Open requests offered to the signed-in technician. The driver's phone and exact
-- position are withheld until the technician accepts.
create or replace function public.technician_inbox()
returns table (
  id uuid,
  code text,
  category text,
  description text,
  urgency public.urgency_level,
  ai_summary text,
  vehicle jsonb,
  place_label text,
  approx_lat double precision,
  approx_lng double precision,
  distance_km double precision,
  is_direct boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.code, r.category, r.description, r.urgency, r.ai_summary, r.vehicle, r.place_label,
    round(r.lat::numeric, 2)::double precision,
    round(r.lng::numeric, 2)::double precision,
    round(public.distance_km(t.lat, t.lng, r.lat, r.lng)::numeric, 1)::double precision,
    r.requested_technician_id is not distinct from t.id,
    r.created_at
  from public.technicians t
  join public.service_requests r
    on r.status = 'pending'
   and r.technician_id is null
   and r.created_at > now() - interval '24 hours'
  where t.user_id = auth.uid()
    and t.verification_status = 'verified'
    and (
      r.requested_technician_id = t.id
      or (
        r.requested_technician_id is null
        and t.availability = 'available'
        and public.distance_km(t.lat, t.lng, r.lat, r.lng) <= t.service_radius_km
        and not exists (
          select 1 from public.request_declines d where d.request_id = r.id and d.technician_id = t.id
        )
      )
    )
  order by (r.requested_technician_id is not distinct from t.id) desc, r.created_at desc
  limit 50;
$$;

create or replace function public.accept_service_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(true);
  v_req public.service_requests;
  v_minutes integer;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
  if v_req.status <> 'pending' or v_req.technician_id is not null then
    raise exception 'ONYX:conflict';
  end if;
  -- `is not distinct from`: a broadcast request has no requested technician (null), and
  -- `null = id` would make the whole condition null — i.e. silently allowed.
  if not (
    v_req.requested_technician_id is not distinct from v_tech.id
    or (
      v_req.requested_technician_id is null
      and public.distance_km(v_tech.lat, v_tech.lng, v_req.lat, v_req.lng) <= v_tech.service_radius_km
      and not exists (
        select 1 from public.request_declines d where d.request_id = v_req.id and d.technician_id = v_tech.id
      )
    )
  ) then
    raise exception 'ONYX:forbidden';
  end if;

  update public.service_requests
     set technician_id = v_tech.id, status = 'accepted', accepted_at = now()
   where id = p_request_id;

  v_minutes := greatest(0, round(extract(epoch from now() - v_req.created_at) / 60)::integer);
  update public.technicians
     set avg_response_minutes = round(
           (coalesce(avg_response_minutes, v_minutes)::numeric * accepted_count + v_minutes) / (accepted_count + 1)
         )::integer,
         accepted_count = accepted_count + 1,
         availability = 'busy',
         last_seen_at = now()
   where id = v_tech.id;

  perform public.log_request_event(
    p_request_id, 'accepted', 'technician', jsonb_build_object('technicianName', v_tech.business_name)
  );
end;
$$;

create or replace function public.decline_service_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(true);
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ONYX:invalid_transition';
  end if;

  insert into public.request_declines (request_id, technician_id)
  values (p_request_id, v_tech.id)
  on conflict do nothing;

  -- A direct request that is declined is opened to every technician nearby.
  if v_req.requested_technician_id = v_tech.id then
    update public.service_requests set requested_technician_id = null where id = p_request_id;
    perform public.log_request_event(
      p_request_id, 'declined', 'technician', jsonb_build_object('technicianName', v_tech.business_name)
    );
  end if;
end;
$$;

create or replace function public.release_service_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
begin
  if not public.can_transition(v_req.status, 'pending', 'technician') then
    raise exception 'ONYX:invalid_transition';
  end if;

  update public.service_requests
     set status = 'pending', technician_id = null, requested_technician_id = null,
         accepted_at = null, en_route_at = null,
         technician_lat = null, technician_lng = null, technician_location_at = null
   where id = p_request_id;

  insert into public.request_declines (request_id, technician_id)
  values (p_request_id, v_tech.id)
  on conflict do nothing;

  perform public.free_up_technician(v_tech.id, p_request_id);
  perform public.log_request_event(
    p_request_id, 'released', 'technician', jsonb_build_object('reason', nullif(left(btrim(coalesce(p_reason, '')), 300), ''))
  );
end;
$$;

create or replace function public.advance_service_request(p_request_id uuid, p_status public.request_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
begin
  if p_status not in ('en_route', 'arrived', 'in_progress') then
    raise exception 'ONYX:validation';
  end if;
  if not public.can_transition(v_req.status, p_status, 'technician') then
    raise exception 'ONYX:invalid_transition';
  end if;

  update public.service_requests
     set status = p_status,
         en_route_at = case when p_status = 'en_route' then now() else en_route_at end,
         arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
         started_at = case when p_status = 'in_progress' then now() else started_at end,
         technician_lat = case when p_status = 'arrived' then null else technician_lat end,
         technician_lng = case when p_status = 'arrived' then null else technician_lng end,
         technician_location_at = case when p_status = 'arrived' then null else technician_location_at end
   where id = p_request_id;

  update public.technicians set last_seen_at = now() where id = v_tech.id;
  perform public.log_request_event(
    p_request_id,
    case p_status when 'en_route' then 'en_route' when 'arrived' then 'arrived' else 'started' end,
    'technician'
  );
end;
$$;

create or replace function public.save_diagnosis(p_request_id uuid, p_diagnosis text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
begin
  if v_req.status not in ('arrived', 'quoted', 'in_progress') then
    raise exception 'ONYX:invalid_transition';
  end if;
  update public.service_requests
     set diagnosis = nullif(left(btrim(coalesce(p_diagnosis, '')), 2000), '')
   where id = p_request_id;
  perform public.log_request_event(p_request_id, 'diagnosis', 'technician');
end;
$$;

-- Totals are always computed here; whatever total a client sends is ignored.
create or replace function public.send_quote(p_request_id uuid, p_items jsonb, p_note text default null)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
  v_item jsonb;
  v_label text;
  v_kind text;
  v_qty integer;
  v_price integer;
  v_total bigint := 0;
  v_clean jsonb := '[]'::jsonb;
  v_quote public.quotes;
begin
  if v_req.status not in ('arrived', 'quoted') then
    raise exception 'ONYX:invalid_transition';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'ONYX:validation';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'ONYX:validation';
    end if;
    v_label := btrim(v_item ->> 'label');
    v_kind := v_item ->> 'kind';
    v_qty := (v_item ->> 'quantity')::integer;
    v_price := (v_item ->> 'unitPrice')::integer;
    if v_label is null or char_length(v_label) not between 1 and 80
       or v_kind is null or v_kind not in ('part', 'labour', 'travel')
       or v_qty is null or v_qty not between 1 and 100
       or v_price is null or v_price not between 0 and 5000000 then
      raise exception 'ONYX:validation';
    end if;
    v_total := v_total + v_qty::bigint * v_price;
    v_clean := v_clean || jsonb_build_array(
      jsonb_build_object('label', v_label, 'kind', v_kind, 'quantity', v_qty, 'unitPrice', v_price)
    );
  end loop;

  if v_total > 2147483647 then
    raise exception 'ONYX:validation';
  end if;

  update public.quotes set status = 'superseded' where request_id = p_request_id and status = 'pending';
  insert into public.quotes (request_id, technician_id, items, total, note)
  values (p_request_id, v_tech.id, v_clean, v_total::integer, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  returning * into v_quote;

  update public.service_requests set status = 'quoted' where id = p_request_id;
  perform public.log_request_event(p_request_id, 'quote_sent', 'technician', jsonb_build_object('total', v_quote.total));
  return v_quote;
end;
$$;

create or replace function public.complete_service_request(
  p_request_id uuid, p_method public.payment_method, p_amount integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
  v_quote_id uuid;
begin
  if not public.can_transition(v_req.status, 'completed', 'technician') then
    raise exception 'ONYX:invalid_transition';
  end if;
  if p_method is null or p_amount is null or p_amount not between 0 and 10000000 then
    raise exception 'ONYX:validation';
  end if;

  select id into v_quote_id from public.quotes where request_id = p_request_id and status = 'accepted';

  update public.service_requests set status = 'completed', completed_at = now() where id = p_request_id;

  insert into public.payments (
    request_id, quote_id, technician_id, driver_id, amount, commission, method, status, paid_at
  ) values (
    p_request_id, v_quote_id, v_tech.id, v_req.driver_id, p_amount,
    round(p_amount * public.platform_commission_rate())::integer, p_method, 'paid', now()
  );

  update public.technicians set jobs_completed = jobs_completed + 1, last_seen_at = now() where id = v_tech.id;
  perform public.free_up_technician(v_tech.id, p_request_id);
  perform public.log_request_event(
    p_request_id, 'completed', 'technician', jsonb_build_object('amount', p_amount, 'method', p_method)
  );
end;
$$;

create or replace function public.update_job_location(p_request_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians := public.require_my_technician(false);
  v_req public.service_requests := public.require_assigned_request(p_request_id, v_tech.id);
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'ONYX:validation';
  end if;
  -- Only while travelling to the driver, and at most every 5 seconds.
  if v_req.status not in ('accepted', 'en_route') then
    return;
  end if;
  if v_req.technician_location_at is not null and v_req.technician_location_at > now() - interval '5 seconds' then
    return;
  end if;
  update public.service_requests
     set technician_lat = p_lat, technician_lng = p_lng, technician_location_at = now()
   where id = p_request_id;
  update public.technicians set last_seen_at = now() where id = v_tech.id;
end;
$$;

create or replace function public.technician_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tech public.technicians;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Douala') at time zone 'Africa/Douala';
begin
  select * into v_tech from public.technicians where user_id = auth.uid();
  if not found then
    raise exception 'ONYX:forbidden';
  end if;
  return jsonb_build_object(
    'activeJobs', (
      select count(*) from public.service_requests
       where technician_id = v_tech.id and status not in ('completed', 'cancelled')
    ),
    'jobsThisMonth', (
      select count(*) from public.service_requests
       where technician_id = v_tech.id and status = 'completed' and completed_at >= v_month_start
    ),
    'revenueThisMonth', (
      select coalesce(sum(amount), 0) from public.payments
       where technician_id = v_tech.id and status = 'paid' and coalesce(paid_at, created_at) >= v_month_start
    ),
    'commissionDue', (
      select coalesce(sum(commission), 0) from public.payments
       where technician_id = v_tech.id and status = 'paid' and commission_settled_at is null
    ),
    'jobsCompleted', v_tech.jobs_completed,
    'ratingAvg', v_tech.rating_avg,
    'ratingCount', v_tech.rating_count,
    'avgResponseMinutes', v_tech.avg_response_minutes
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_technicians(
  p_status public.verification_status default null, p_id uuid default null
)
returns setof public.technicians
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;
  return query
    select * from public.technicians t
     where (p_status is null or t.verification_status = p_status)
       and (p_id is null or t.id = p_id)
     order by t.created_at desc
     limit 500;
end;
$$;

create or replace function public.admin_set_verification(
  p_technician_id uuid, p_status public.verification_status, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;
  if p_status in ('rejected', 'suspended') and v_note is null then
    raise exception 'ONYX:validation';
  end if;
  update public.technicians
     set verification_status = p_status,
         verification_note = v_note,
         verified_at = case when p_status = 'verified' then now() else verified_at end,
         verified_by = case when p_status = 'verified' then auth.uid() else verified_by end,
         availability = case when p_status = 'verified' then availability else 'offline'::public.availability_status end
   where id = p_technician_id;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
end;
$$;

create or replace function public.admin_settle_commission(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;
  update public.payments
     set commission_settled_at = coalesce(commission_settled_at, now())
   where id = p_payment_id;
  if not found then
    raise exception 'ONYX:not_found';
  end if;
end;
$$;

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Douala')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;

  with r30 as (
    select * from public.service_requests where created_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'requests', (
      select jsonb_build_object(
        'today', (
          select count(*) from public.service_requests
           where (created_at at time zone 'Africa/Douala')::date = v_today
        ),
        'last7d', (select count(*) from public.service_requests where created_at >= now() - interval '7 days'),
        'last30d', count(*),
        'active', (select count(*) from public.service_requests where status not in ('completed', 'cancelled')),
        'completed30d', count(*) filter (where status = 'completed'),
        'cancelled30d', count(*) filter (where status = 'cancelled'),
        'completionRate', case
          when count(*) filter (where status in ('completed', 'cancelled')) = 0 then null
          else round(
            (count(*) filter (where status = 'completed'))::numeric
            / count(*) filter (where status in ('completed', 'cancelled')), 4)
        end
      ) from r30
    ),
    'avgResponseMinutes', (
      select round(avg(extract(epoch from accepted_at - created_at) / 60)::numeric, 1)
        from r30 where accepted_at is not null
    ),
    'avgArrivalMinutes', (
      select round(avg(extract(epoch from arrived_at - accepted_at) / 60)::numeric, 1)
        from r30 where arrived_at is not null and accepted_at is not null
    ),
    'rating', (
      select jsonb_build_object(
        'avg', round(avg(rating)::numeric, 2),
        'count', count(*),
        'csat', case when count(*) = 0 then null else round((count(*) filter (where rating >= 4))::numeric / count(*), 4) end,
        'distribution', jsonb_build_array(
          count(*) filter (where rating = 1), count(*) filter (where rating = 2),
          count(*) filter (where rating = 3), count(*) filter (where rating = 4),
          count(*) filter (where rating = 5)
        )
      ) from public.reviews
    ),
    'revenue', (
      select jsonb_build_object(
        'gmv30d', coalesce(sum(amount) filter (where coalesce(paid_at, created_at) >= now() - interval '30 days'), 0),
        'commission30d', coalesce(sum(commission) filter (where coalesce(paid_at, created_at) >= now() - interval '30 days'), 0),
        'commissionUnsettled', coalesce(sum(commission) filter (where commission_settled_at is null), 0)
      ) from public.payments where status = 'paid'
    ),
    'technicians', (
      select jsonb_build_object(
        'verified', count(*) filter (where verification_status = 'verified'),
        'pending', count(*) filter (where verification_status = 'pending'),
        'availableNow', count(*) filter (where verification_status = 'verified' and availability = 'available')
      ) from public.technicians
    ),
    'daily', (
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(day, 'YYYY-MM-DD'),
          'created', coalesce(s.created, 0),
          'completed', coalesce(s.completed, 0),
          'cancelled', coalesce(s.cancelled, 0)
        ) order by day
      )
      from generate_series((v_today - 13)::timestamp, v_today::timestamp, interval '1 day') as day
      left join (
        select (created_at at time zone 'Africa/Douala')::date as d,
               count(*) as created,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status = 'cancelled') as cancelled
          from public.service_requests
         where created_at >= now() - interval '15 days'
         group by 1
      ) s on s.d = day::date
    ),
    'byCategory', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc), '[]'::jsonb)
        from (select category, count(*) as n from r30 group by category) c
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_technician_performance(p_technician_id uuid default null)
returns table (
  technician_id uuid,
  business_name text,
  area text,
  verification_status public.verification_status,
  jobs_completed_30d bigint,
  jobs_cancelled_30d bigint,
  completion_rate numeric,
  avg_response_minutes integer,
  rating_avg numeric,
  rating_count integer,
  revenue_30d bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'ONYX:forbidden';
  end if;
  return query
    select
      t.id,
      t.business_name,
      t.area,
      t.verification_status,
      count(r.id) filter (where r.status = 'completed'),
      count(r.id) filter (where r.status = 'cancelled'),
      case
        when count(r.id) filter (where r.status in ('completed', 'cancelled')) = 0 then null
        else round(
          (count(r.id) filter (where r.status = 'completed'))::numeric
          / count(r.id) filter (where r.status in ('completed', 'cancelled')), 4)
      end,
      t.avg_response_minutes,
      t.rating_avg,
      t.rating_count,
      coalesce((
        select sum(p.amount) from public.payments p
         where p.technician_id = t.id and p.status = 'paid'
           and coalesce(p.paid_at, p.created_at) >= now() - interval '30 days'
      ), 0)::bigint
    from public.technicians t
    left join public.service_requests r
      on r.technician_id = t.id and r.created_at >= now() - interval '30 days'
    where (p_technician_id is null and t.verification_status = 'verified')
       or t.id = p_technician_id
    group by t.id
    order by 11 desc, 5 desc;
end;
$$;
