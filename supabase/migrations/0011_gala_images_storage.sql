-- ============================================================
-- Item 2: gala thumbnails. Public bucket (poster images aren't
-- sensitive — public keeps the frontend simple, no signed URLs
-- needed), write access coach-only, matching galas' own write policy.
-- ============================================================
insert into storage.buckets (id, name, public) values ('gala-images', 'gala-images', true);

create policy "gala_images_select_public" on storage.objects
  for select using (bucket_id = 'gala-images');
create policy "gala_images_insert_coach_only" on storage.objects
  for insert with check (bucket_id = 'gala-images' and is_coach());
create policy "gala_images_update_coach_only" on storage.objects
  for update using (bucket_id = 'gala-images' and is_coach());
create policy "gala_images_delete_coach_only" on storage.objects
  for delete using (bucket_id = 'gala-images' and is_coach());
