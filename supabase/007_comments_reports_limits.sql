-- Run this in Supabase → SQL Editor AFTER 006_edit_expiry.sql.
-- Adds: optional comments on posts, reporting (posts with 3+ reports are hidden),
-- and a limit of 10 active posts per user.

-- ---------- Comments ----------

alter table public.posts add column if not exists comments_enabled boolean not null default false;
grant update (comments_enabled) on public.posts to authenticated;

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_id_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

-- Anyone signed in can comment on a live post that allows comments
drop policy if exists "add comments" on public.post_comments;
create policy "add comments" on public.post_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.comments_enabled and p.expires_at > now()
    )
  );

-- Comments are read through post_comments_for() and deleted through delete_comment()
-- (both below), so the table itself never exposes user ids
revoke all on public.post_comments from anon, authenticated;
grant insert on public.post_comments to authenticated;

-- ---------- Reports ----------

create table if not exists public.post_reports (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text not null check (reason in ('spam', 'inappropriate', 'scam', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id) -- one report per person per post
);

alter table public.post_reports enable row level security;

drop policy if exists "add own reports" on public.post_reports;
create policy "add own reports" on public.post_reports
  for insert to authenticated with check (user_id = auth.uid());

revoke all on public.post_reports from anon;
grant insert on public.post_reports to authenticated;
-- Review reports in the dashboard: Table Editor → post_reports

-- ---------- 10 active posts per user ----------

-- Runs on new posts and when an expired post is renewed, so the limit can't be dodged
create or replace function public.enforce_post_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expires_at > now() and (tg_op = 'INSERT' or old.expires_at <= now()) then
    if (select count(*) from posts
        where user_id = new.user_id and expires_at > now() and id <> new.id) >= 10 then
      raise exception 'You can have up to 10 active posts. Delete one or let one expire to post again.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_limit on public.posts;
create trigger posts_limit
  before insert or update of expires_at on public.posts
  for each row execute function public.enforce_post_limit();

-- ---------- Functions (new columns, so drop and recreate) ----------

drop function if exists public.posts_in_view(double precision, double precision, double precision, double precision);
drop function if exists public.my_posts();
drop function if exists public.saved_posts();
drop function if exists public.create_post(text, text, text, double precision, double precision, text, integer);
drop function if exists public.create_post(text, text, text, double precision, double precision, text, integer, boolean);
drop function if exists public.post_comments_for(uuid);

-- Shared row shape for the three list functions
-- Only used inside the security-definer functions below (not exposed to the API)
create or replace view public.post_rows with (security_invoker = true) as
  select p.id, p.user_id, p.title, p.body, p.category, p.image_path,
         st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
         p.created_at, p.expires_at, p.comments_enabled,
         (select count(*)::int from post_saves s where s.post_id = p.id) as save_count,
         (select count(*)::int from post_comments c where c.post_id = p.id) as comment_count,
         (select count(*)::int from post_reports r where r.post_id = p.id) as report_count,
         p.location
  from posts p;
revoke all on public.post_rows from anon, authenticated;

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
  comments_enabled boolean, save_count integer, comment_count integer,
  saved boolean, mine boolean, hidden boolean
)
language sql stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.body, r.category, r.image_path, r.lat, r.lng,
         r.created_at, r.expires_at, r.comments_enabled, r.save_count, r.comment_count,
         exists (select 1 from post_saves s where s.post_id = r.id and s.user_id = auth.uid()),
         coalesce(r.user_id = auth.uid(), false),
         false
  from post_rows r
  where r.expires_at > now()
    and r.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    and r.report_count < 3                                    -- hidden after 3 reports
    and not exists (select 1 from post_reports x               -- and for whoever reported it
                    where x.post_id = r.id and x.user_id = auth.uid())
  order by r.created_at desc
  limit 500;
$$;

create function public.my_posts()
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz,
  comments_enabled boolean, save_count integer, comment_count integer,
  saved boolean, mine boolean, hidden boolean
)
language sql stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.body, r.category, r.image_path, r.lat, r.lng,
         r.created_at, r.expires_at, r.comments_enabled, r.save_count, r.comment_count,
         exists (select 1 from post_saves s where s.post_id = r.id and s.user_id = auth.uid()),
         true,
         r.report_count >= 3
  from post_rows r
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

create function public.saved_posts()
returns table (
  id uuid, title text, body text, category text, image_path text,
  lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz,
  comments_enabled boolean, save_count integer, comment_count integer,
  saved boolean, mine boolean, hidden boolean
)
language sql stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.body, r.category, r.image_path, r.lat, r.lng,
         r.created_at, r.expires_at, r.comments_enabled, r.save_count, r.comment_count,
         true,
         coalesce(r.user_id = auth.uid(), false),
         r.report_count >= 3
  from post_saves s
  join post_rows r on r.id = s.post_id
  where s.user_id = auth.uid()
  order by s.created_at desc;
$$;

-- Comments on a post, oldest first. Never exposes user ids: just whether a comment
-- is yours, by the poster, and whether you're allowed to delete it.
create function public.post_comments_for(p_post_id uuid)
returns table (id uuid, body text, created_at timestamptz, mine boolean, by_poster boolean, can_delete boolean)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.body, c.created_at,
         coalesce(c.user_id = auth.uid(), false),
         c.user_id = p.user_id,
         coalesce(c.user_id = auth.uid() or p.user_id = auth.uid(), false)
  from post_comments c
  join posts p on p.id = c.post_id
  where c.post_id = p_post_id
    and (p.expires_at > now() or p.user_id = auth.uid())
  order by c.created_at;
$$;

-- Commenters can delete their own comments; posters can delete any comment on their post.
-- Returns false if the comment doesn't exist or isn't yours to delete.
create or replace function public.delete_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from post_comments c
  using posts p
  where c.id = p_comment_id
    and p.id = c.post_id
    and (c.user_id = auth.uid() or p.user_id = auth.uid());
  return found;
end;
$$;

create function public.create_post(
  p_title text,
  p_body text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_image_path text default null,
  p_duration_days integer default 30,
  p_comments_enabled boolean default false
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
  if p_duration_days is null or p_duration_days not between 1 and 90 then
    raise exception 'Posts can last between 1 and 90 days';
  end if;

  insert into public.posts (title, body, category, location, user_id, image_path, expires_at, comments_enabled)
  values (p_title, coalesce(p_body, ''), coalesce(p_category, 'general'),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, auth.uid(), p_image_path,
          now() + make_interval(days => p_duration_days), coalesce(p_comments_enabled, false))
  returning id into new_id;

  return new_id;
end;
$$;

-- Browsing the map and reading comments work without an account
grant execute on function public.posts_in_view, public.post_comments_for to anon, authenticated;
revoke execute on function public.my_posts, public.saved_posts, public.create_post, public.delete_comment from anon, public;
grant execute on function public.my_posts, public.saved_posts, public.create_post, public.delete_comment to authenticated;
