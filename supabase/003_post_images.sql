-- Run this in Supabase → SQL Editor AFTER 002_user_posts.sql.
-- Adds one optional image per post, stored in a public Storage bucket.

alter table public.posts add column if not exists image_path text;

-- Public bucket: anyone can view images, only signed-in users can upload.
-- 5 MB cap per file (the app resizes images before upload, so they're usually ~200 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Users can only upload/delete files inside their own folder: <user id>/<file>
drop policy if exists "upload own post images" on storage.objects;
create policy "upload own post images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own post images" on storage.objects;
create policy "delete own post images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Owners can change or remove a post's image, but only to a file in their own folder
grant update (image_path) on public.posts to authenticated;

drop policy if exists "update own posts" on public.posts;
create policy "update own posts" on public.posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (image_path is null or image_path like auth.uid()::text || '/%')
  );

-- Return types change, so the old functions have to be dropped first
drop function if exists public.posts_in_view(double precision, double precision, double precision, double precision);
drop function if exists public.my_posts();
drop function if exists public.create_post(text, text, text, double precision, double precision);

create function public.posts_in_view(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz
)
language sql stable
as $$
  select p.id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at
  from public.posts p
  where p.expires_at > now()
    and p.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by p.created_at desc
  limit 500;
$$;

create function public.my_posts()
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz
)
language sql stable
as $$
  select p.id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at
  from public.posts p
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;

create function public.create_post(
  p_title text,
  p_body text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to post';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;
  if p_image_path is not null and p_image_path not like auth.uid()::text || '/%' then
    raise exception 'Invalid image';
  end if;

  insert into public.posts (title, body, category, location, user_id, image_path)
  values (p_title, coalesce(p_body, ''), coalesce(p_category, 'general'),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, auth.uid(), p_image_path)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.posts_in_view to anon, authenticated;
grant execute on function public.my_posts to authenticated;
revoke execute on function public.create_post from anon, public;
grant execute on function public.create_post to authenticated;
