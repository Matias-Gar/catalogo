-- Store logo storage setup (Supabase Storage)
-- Run this if you want to upload the store logo from /admin/whatsapp.

insert into storage.buckets (id, name, public)
values ('product_images', 'product_images', true)
on conflict (id) do update
set public = excluded.public;

-- Public read access for images in this bucket
create policy if not exists "Public can view product_images"
on storage.objects for select
using (bucket_id = 'product_images');

-- Authenticated users can upload store logo files
create policy if not exists "Authenticated can upload product_images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product_images');

-- Authenticated users can update product_images
create policy if not exists "Authenticated can update product_images"
on storage.objects for update
to authenticated
using (bucket_id = 'product_images')
with check (bucket_id = 'product_images');

-- Authenticated users can delete product_images
create policy if not exists "Authenticated can delete product_images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product_images');
