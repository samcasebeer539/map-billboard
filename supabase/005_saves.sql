-- Run this in Supabase → SQL Editor AFTER 004_post_duration.sql.
-- Lets people save (bookmark) posts, and shows a save count on each post.

create table if not exists public.post_saves (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists post_saves_post_id_idx on public.post_saves (post_id);

-- Each user can only see, add and remove their own saves
alter table public.post_saves enable row level security;

drop policy if exists "read own saves" on public.post_saves;
create policy "read own saves" on public.post_saves
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "add own saves" on public.post_saves;
create policy "add own saves" on public.post_saves
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "remove own saves" on public.post_saves;
create policy "remove own saves" on public.post_saves
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.post_saves from anon;
grant select, insert, delete on public.post_saves to authenticated;

-- Return types change (save_count, saved), so drop and recreate.
-- These run as security definer so they can count everyone's saves, which RLS would
-- otherwise hide; they only ever return live posts or the caller's own data.
drop function if exists public.posts_in_view(double precision, double precision, double precision, double precision);
drop function if exists public.my_posts();
drop function if exists public.saved_posts();

create function public.posts_in_view(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz,
  save_count integer, saved boolean
)
language sql stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at,
         (select count(*)::int from post_saves s where s.post_id = p.id),
         exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = auth.uid())
  from posts p
  where p.expires_at > now()
    and p.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by p.created_at desc
  limit 500;
$$;

create function public.my_posts()
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz,
  save_count integer, saved boolean
)
language sql stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at,
         (select count(*)::int from post_saves s where s.post_id = p.id),
         exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = auth.uid())
  from posts p
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;

-- Posts the caller has saved, most recently saved first (expired ones included, so they can be cleared)
create function public.saved_posts()
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz,
  save_count integer, saved boolean
)
language sql stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry), st_x(p.location::geometry),
         p.created_at, p.expires_at,
         (select count(*)::int from post_saves s2 where s2.post_id = p.id),
         true
  from post_saves s
  join posts p on p.id = s.post_id
  where s.user_id = auth.uid()
  order by s.created_at desc;
$$;

grant execute on function public.posts_in_view to anon, authenticated;
revoke execute on function public.my_posts from anon, public;
revoke execute on function public.saved_posts from anon, public;
grant execute on function public.my_posts to authenticated;
grant execute on function public.saved_posts to authenticated;
