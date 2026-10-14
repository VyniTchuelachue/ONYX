-- ONYX schema: profiles, technicians, service requests and everything around a job.
-- Enumerations mirror packages/core/src/constants.ts — change both together.

create type public.user_role as enum ('driver', 'technician', 'admin');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.availability_status as enum ('available', 'busy', 'offline');
create type public.request_status as enum (
  'pending', 'accepted', 'en_route', 'arrived', 'quoted', 'in_progress', 'completed', 'cancelled'
);
create type public.urgency_level as enum ('low', 'medium', 'high', 'critical');
create type public.quote_status as enum ('pending', 'accepted', 'declined', 'superseded');
create type public.payment_method as enum ('cash', 'mtn_momo', 'orange_money');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles: one per auth user, created by trigger on sign-up.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'driver',
  full_name text not null default '' check (char_length(full_name) <= 80),
  email text,
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  default_vehicle jsonb check (default_vehicle is null or jsonb_typeof(default_vehicle) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Technicians: public listings. `user_id` is null for listings onboarded by the
-- ONYX field team before the technician has an account.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  business_name text not null check (char_length(business_name) between 2 and 80),
  owner_name text not null check (char_length(owner_name) between 2 and 80),
  bio text check (char_length(bio) <= 500),
  phone text not null check (phone ~ '^\+237[26][0-9]{8}$'),
  whatsapp text check (whatsapp ~ '^\+237[26][0-9]{8}$'),
  specialties text[] not null check (
    cardinality(specialties) between 1 and 8
    and specialties <@ array['mechanic', 'electrical', 'tires', 'towing', 'battery', 'diagnostics', 'ac', 'bodywork']
  ),
  vehicle_types text[] not null default array['car'] check (
    cardinality(vehicle_types) between 1 and 4
    and vehicle_types <@ array['car', 'motorcycle', 'truck', 'bus']
  ),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text check (char_length(address) <= 200),
  area text not null default '' check (char_length(area) <= 60),
  city text not null default 'Douala' check (char_length(city) <= 60),
  corridors text[] not null default '{}' check (
    corridors <@ array['douala-yaounde', 'douala-bafoussam', 'douala-limbe', 'douala-kribi']
  ),
  service_radius_km integer not null default 15 check (service_radius_km between 1 and 300),
  mobile_service boolean not null default true,
  has_tow_truck boolean not null default false,
  opening_hours text check (char_length(opening_hours) <= 120),
  years_experience integer check (years_experience between 0 and 60),
  photo_url text check (char_length(photo_url) <= 500),
  verification_status public.verification_status not null default 'pending',
  verification_note text check (char_length(verification_note) <= 500),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  availability public.availability_status not null default 'offline',
  availability_updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  jobs_completed integer not null default 0,
  avg_response_minutes integer,
  accepted_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Discovery pre-filters on a bounding box, then computes exact distances.
create index technicians_verified_geo_idx on public.technicians (lat, lng) where verification_status = 'verified';
create index technicians_status_idx on public.technicians (verification_status, created_at desc);
create index technicians_corridors_idx on public.technicians using gin (corridors);

create table public.technician_documents (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  kind text not null check (kind in ('id_card', 'business_license', 'garage_photo', 'certificate')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null check (char_length(storage_path) <= 300),
  created_at timestamptz not null default now()
);
create index technician_documents_tech_idx on public.technician_documents (technician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Service requests and their history.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.generate_request_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := 'ONX-';
begin
  for i in 1..5 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_request_code(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  contact_phone text not null check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  requested_technician_id uuid references public.technicians (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  status public.request_status not null default 'pending',
  category text not null check (category in (
    'wont_start', 'flat_tire', 'battery', 'overheating', 'engine', 'brakes', 'electrical', 'fuel',
    'clutch_gearbox', 'warning_light', 'smoke_fire', 'accident', 'other'
  )),
  description text not null default '' check (char_length(description) <= 1000),
  urgency public.urgency_level not null default 'medium',
  ai_summary text check (char_length(ai_summary) <= 2000),
  vehicle jsonb not null default '{}'::jsonb check (jsonb_typeof(vehicle) = 'object'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  landmark text not null check (char_length(landmark) between 3 and 200),
  place_label text check (char_length(place_label) <= 120),
  diagnosis text check (char_length(diagnosis) <= 2000),
  technician_lat double precision,
  technician_lng double precision,
  technician_location_at timestamptz,
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  cancelled_by public.user_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_requests_driver_idx on public.service_requests (driver_id, created_at desc);
create index service_requests_technician_idx on public.service_requests (technician_id, status);
create index service_requests_status_idx on public.service_requests (status, created_at desc);
create index service_requests_open_idx on public.service_requests (created_at desc) where status = 'pending';

create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests (id) on delete cascade,
  type text not null check (type in (
    'created', 'accepted', 'declined', 'released', 'en_route', 'arrived', 'diagnosis', 'quote_sent',
    'quote_accepted', 'quote_declined', 'started', 'completed', 'cancelled', 'reviewed'
  )),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.user_role,
  message text check (char_length(message) <= 500),
  data jsonb,
  created_at timestamptz not null default now()
);
create index request_events_request_idx on public.request_events (request_id, id);

-- Technicians who passed on (or withdrew from) a request don't see it again.
create table public.request_declines (
  request_id uuid not null references public.service_requests (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, technician_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  total integer not null check (total >= 0),
  note text check (char_length(note) <= 500),
  status public.quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index quotes_request_idx on public.quotes (request_id, created_at desc);
create unique index quotes_one_pending_idx on public.quotes (request_id) where status = 'pending';
create unique index quotes_one_accepted_idx on public.quotes (request_id) where status = 'accepted';

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  driver_id uuid references auth.users (id) on delete set null,
  reviewer_name text not null default '' check (char_length(reviewer_name) <= 60),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  tags text[] not null default '{}' check (
    tags <@ array['punctual', 'fair_price', 'professional', 'clear_explanation', 'quality_work']
  ),
  created_at timestamptz not null default now()
);
create index reviews_technician_idx on public.reviews (technician_id, created_at desc);

-- Customers pay the technician directly (cash or mobile money); ONYX records the
-- payment and the commission it then collects from the technician.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  driver_id uuid references auth.users (id) on delete set null,
  amount integer not null check (amount >= 0),
  commission integer not null check (commission >= 0),
  method public.payment_method not null,
  status public.payment_status not null default 'paid',
  provider_ref text check (char_length(provider_ref) <= 120),
  paid_at timestamptz,
  commission_settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_technician_idx on public.payments (technician_id, created_at desc);
create index payments_created_idx on public.payments (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Housekeeping triggers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger technicians_updated_at before update on public.technicians
  for each row execute function public.set_updated_at();
create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function public.set_updated_at();

create or replace function public.touch_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.availability is distinct from old.availability then
    new.availability_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger technicians_availability_touch before update on public.technicians
  for each row execute function public.touch_availability();

-- New auth user → profile. Only `driver` is ever assigned here; technician and admin
-- roles are granted by register_technician() and by an admin respectively.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  candidate_phone text := meta ->> 'phone';
begin
  insert into public.profiles (id, email, full_name, phone, locale)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'full_name', ''), 80),
    case when candidate_phone ~ '^\+[1-9][0-9]{7,14}$' then candidate_phone end,
    case when meta ->> 'locale' in ('fr', 'en') then meta ->> 'locale' else 'fr' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
