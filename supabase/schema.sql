-- Run this in Supabase → SQL Editor.

create extension if not exists postgis;

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 80),
  body        text not null default '' check (char_length(body) <= 500),
  category    text not null default 'general',
  location    geography(Point, 4326) not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

-- Spatial index: makes "posts in this area" queries fast
create index if not exists posts_location_idx on public.posts using gist (location);

-- Row Level Security: anyone can read live posts. Writes only go through create_post().
alter table public.posts enable row level security;

drop policy if exists "read live posts" on public.posts;
create policy "read live posts" on public.posts
  for select using (expires_at > now());

-- Posts inside the current map view (bounding box)
create or replace function public.posts_in_view(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid, title text, body text, category text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz
)
language sql stable
as $$
  select p.id, p.title, p.body, p.category,
         st_y(p.location::geometry) as lat,
         st_x(p.location::geometry) as lng,
         p.created_at, p.expires_at
  from public.posts p
  where p.expires_at > now()
    and p.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by p.created_at desc
  limit 500;
$$;

-- Create a post. security definer lets anon users insert only through this function.
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
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into public.posts (title, body, category, location)
  values (p_title, coalesce(p_body, ''), coalesce(p_category, 'general'),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.posts_in_view to anon, authenticated;
grant execute on function public.create_post to anon, authenticated;
