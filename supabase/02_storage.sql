-- STEP 2: storage buckets for logos and photos + upload permissions
insert into storage.buckets (id, name, public)
values ('logos','logos',true), ('photos','photos',true)
on conflict (id) do nothing;

create policy "media public read" on storage.objects for select
  using (bucket_id in ('logos','photos'));
create policy "media admin insert" on storage.objects for insert
  with check (bucket_id in ('logos','photos') and public.is_admin());
create policy "media admin update" on storage.objects for update
  using (bucket_id in ('logos','photos') and public.is_admin());
create policy "media admin delete" on storage.objects for delete
  using (bucket_id in ('logos','photos') and public.is_admin());
