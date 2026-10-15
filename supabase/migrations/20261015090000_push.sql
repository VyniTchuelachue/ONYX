-- Phone alerts (Web Push).
--
-- Devices that asked for alerts are stored here. When a request event is logged, a trigger
-- asks the app server (POST /api/v1/push/dispatch) to send the alerts; the server calls
-- push_targets() to learn who should hear about it, words each alert in the person's
-- language and delivers it. The trigger needs the pg_net extension and two Vault secrets
-- (see README); until they exist it does nothing.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- No policies: people save and remove their devices through the functions below, and
-- only the server (service role) reads the table.
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- Saves this device for the signed-in person. A device that changes hands (another
-- account signs in on the same phone) moves to the new account.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_locale text default 'fr', p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'ONYX:unauthenticated';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(p_locale, 'fr'), left(p_user_agent, 300))
  on conflict (endpoint) do update
     set user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         locale = excluded.locale,
         user_agent = excluded.user_agent,
         last_seen_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Who should hear about an event, one row per device, with what the message needs.
-- Nobody is alerted about their own action, and offers only go out while the request is
-- still open (the server sends a moment after the event).
create or replace function public.push_targets(p_event_id bigint)
returns table (
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  locale text,
  audience text,
  event_type text,
  actor_role public.user_role,
  request_id uuid,
  request_code text,
  category text,
  place_label text,
  distance_km double precision,
  is_direct boolean,
  technician_name text,
  amount integer,
  rating integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with ev as (
    select e.id, e.type, e.actor_id, e.actor_role, e.data,
           r.id as request_id, r.code, r.category, r.place_label, r.lat, r.lng, r.status,
           r.driver_id, r.technician_id, r.requested_technician_id
      from public.request_events e
      join public.service_requests r on r.id = e.request_id
     where e.id = p_event_id
  ),
  -- The technician the event is about: the one on the job, or the one who just stepped back.
  named as (
    select ev.*,
           coalesce(
             (select t.business_name from public.technicians t where t.id = ev.technician_id),
             ev.data ->> 'technicianName',
             (select t.business_name from public.technicians t where t.user_id = ev.actor_id limit 1)
           ) as technician_name
      from ev
  ),
  recipients as (
    -- The driver hears about each step the technician takes.
    select n.driver_id as user_id, 'driver'::text as audience, null::double precision as distance_km, false as is_direct
      from named n
     where n.type in ('accepted', 'declined', 'released', 'en_route', 'arrived', 'quote_sent', 'completed')
        or (n.type = 'cancelled' and n.actor_role in ('technician', 'admin'))
    union all
    -- The technician on the job hears about the driver's answers.
    select t.user_id, 'technician', null, false
      from named n
      join public.technicians t on t.id = n.technician_id
     where n.type in ('quote_accepted', 'quote_declined', 'reviewed')
        or (n.type = 'cancelled' and n.actor_role in ('driver', 'admin'))
    union all
    -- A driver who picked a technician: only that technician, whatever their availability.
    select t.user_id, 'technician', public.distance_km(t.lat, t.lng, n.lat, n.lng), true
      from named n
      join public.technicians t on t.id = n.requested_technician_id
     where n.type = 'created'
       and n.status = 'pending'
       and n.technician_id is null
       and t.verification_status = 'verified'
    union all
    -- An open request: available technicians in range who haven't passed on it (the inbox rule).
    select t.user_id, 'technician', public.distance_km(t.lat, t.lng, n.lat, n.lng), false
      from named n
      join public.technicians t
        on t.verification_status = 'verified'
       and t.availability = 'available'
       and public.distance_km(t.lat, t.lng, n.lat, n.lng) <= t.service_radius_km
     where n.type in ('created', 'declined', 'released')
       and n.status = 'pending'
       and n.technician_id is null
       and n.requested_technician_id is null
       and not exists (
         select 1 from public.request_declines d where d.request_id = n.request_id and d.technician_id = t.id
       )
  )
  select s.id, s.endpoint, s.p256dh, s.auth, s.locale, rc.audience, n.type, n.actor_role, n.request_id, n.code,
         n.category, n.place_label, round(rc.distance_km::numeric, 1)::double precision, rc.is_direct,
         n.technician_name,
         case when n.type in ('quote_sent', 'quote_accepted', 'quote_declined') then (n.data ->> 'total')::integer end,
         case when n.type = 'reviewed' then (n.data ->> 'rating')::integer end
    from recipients rc
   cross join named n
    join public.push_subscriptions s on s.user_id = rc.user_id
   where rc.user_id is distinct from n.actor_id;
$$;

-- Asks the app server to send alerts for a new event. pg_net queues the HTTP call and sends
-- it after the transaction commits, so a slow or failing server never holds up a request.
create or replace function public.request_event_push_hook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'onyx_push_hook_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'onyx_push_hook_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url,
          jsonb_build_object('eventId', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret);
  return null;
exception when others then
  -- Alerts are best effort: the request itself must always go through.
  raise warning 'ONYX push hook skipped: %', sqlerrm;
  return null;
end;
$$;

create trigger request_events_push
  after insert on public.request_events
  for each row
  when (new.type in (
    'created', 'accepted', 'declined', 'released', 'en_route', 'arrived', 'quote_sent',
    'quote_accepted', 'quote_declined', 'completed', 'cancelled', 'reviewed'
  ))
  execute function public.request_event_push_hook();

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    -- Kept out of the public schema, as Supabase recommends; its functions live in net either way.
    create schema if not exists extensions;
    create extension if not exists pg_net with schema extensions;
  end if;
end;
$$;

-- New functions are executable by everyone unless told otherwise.
revoke execute on function
  public.save_push_subscription(text, text, text, text, text),
  public.delete_push_subscription(text),
  public.push_targets(bigint),
  public.request_event_push_hook()
from public, anon, authenticated;

grant execute on function
  public.save_push_subscription(text, text, text, text, text),
  public.delete_push_subscription(text)
to authenticated;

grant execute on function public.push_targets(bigint) to service_role;
