-- Live job tracking: clients subscribe to changes on the rows they are allowed to read.
alter publication supabase_realtime add table public.service_requests, public.request_events, public.quotes;

-- Verification documents live in a private bucket, one folder per user:
--   technician-documents/<auth.uid()>/<kind>-<timestamp>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technician-documents',
  'technician-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Technicians upload their documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'technician-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Technicians and admins read documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'technician-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "Technicians delete their documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'technician-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
