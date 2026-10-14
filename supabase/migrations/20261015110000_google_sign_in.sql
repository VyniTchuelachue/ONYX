-- Continue with Google: Supabase Auth creates the user and this trigger the profile. Google
-- supplies full_name; its locale can be "en-GB" or "fr-CM", so only the language is kept.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  candidate_phone text := meta ->> 'phone';
  candidate_locale text := lower(left(coalesce(meta ->> 'locale', ''), 2));
begin
  insert into public.profiles (id, email, full_name, phone, locale)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80),
    case when candidate_phone ~ '^\+[1-9][0-9]{7,14}$' then candidate_phone end,
    case when candidate_locale in ('fr', 'en') then candidate_locale else 'fr' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
