-- Run this in Supabase → SQL Editor AFTER schema.sql.
-- Ties posts to a user so people can manage their own posts.
-- Also enable: Authentication → Sign In / Providers → "Allow anonymous sign-ins".

alter table public.posts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists posts_user_id_idx on public.posts (user_id);

-- Owners can see (including expired), edit and delete their own posts
drop policy if exists "read own posts" on public.posts;
create policy "read own posts" on public.posts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "update own posts" on public.posts;
create policy "update own posts" on public.posts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts
  for delete to authenticated using (user_id = auth.uid());

-- Lock down direct writes: inserts go through create_post(), and owners can only
-- change the text fields (not location, owner or expiry).
revoke insert, update, delete on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant update (title, body, category) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- create_post now requires a signed-in user and records the owner
create or replace function public.create_post(
  p_title text,
  p_body text,
  p_category text,
  p_lat double precision,
  p_lng double precision
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

  insert into public.posts (title, body, category, location, user_id)
  values (p_title, coalesce(p_body, ''), coalesce(p_category, 'general'),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

-- The current user's posts, newest first (runs with the caller's permissions)
create or replace function public.my_posts()
returns table (
  id uuid, title text, body text, category text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz
)
language sql stable
as $$
  select p.id, p.title, p.body, p.category,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at
  from public.posts p
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;

revoke execute on function public.create_post from anon;
grant execute on function public.create_post to authenticated;
grant execute on function public.my_posts to authenticated;
