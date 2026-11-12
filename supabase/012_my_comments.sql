-- Run this in Supabase → SQL Editor AFTER 011_reply_to_and_names.sql. Safe to re-run.
-- Your comments and replies across all posts, newest first, for the Profile page.

drop function if exists public.my_comments();

create function public.my_comments()
returns table (
  id uuid, body text, created_at timestamptz, is_reply boolean,
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean,       -- still on the map (not expired, not hidden by reports)
  comments_enabled boolean
)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.body, c.created_at, c.parent_id is not null,
         r.id, r.title, r.category, r.lat, r.lng,
         r.expires_at > now() and r.report_count < 3,
         r.comments_enabled
  from post_comments c
  join post_rows r on r.id = c.post_id
  where c.user_id = auth.uid()
  order by c.created_at desc;
$$;

revoke all on function public.my_comments() from public;
grant execute on function public.my_comments() to authenticated;

notify pgrst, 'reload schema';
