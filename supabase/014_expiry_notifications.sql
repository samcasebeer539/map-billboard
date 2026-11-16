-- Run this in Supabase → SQL Editor AFTER 013_notifications.sql. Safe to re-run.
-- Adds two notifications about your own posts, worked out from their dates (nothing stored):
--   * expiring: from 2 days before a post expires (halfway through, for posts shorter than 4 days)
--   * expired:  for two weeks after it expires
-- Renewing a post (Profile → Edit → Expires) moves the dates, so its notice goes away.

-- New column, so drop and recreate (the two functions built on it too)
drop function if exists public.my_notifications();
drop function if exists public.unread_notification_count();
drop function if exists public.notification_events();

create function public.notification_events()
returns table (
  id uuid, kind text, created_at timestamptz, body text,
  author_no integer, by_poster boolean,
  your_comment text,          -- for replies: the comment of yours they answered
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean, comments_enabled boolean,
  expires_at timestamptz      -- for expiring / expired notices
)
language sql stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  events as (
    -- replies to you: answering your reply directly, or in the thread under your top comment
    -- (but not when they're answering someone else's reply in that thread)
    select c.id, 'reply'::text as kind, mine.body as your_comment, c.post_id, c.user_id, c.created_at, c.body
    from post_comments c
    join post_comments mine on mine.id = coalesce(c.reply_to_id, c.parent_id)
    , me
    where c.parent_id is not null and mine.user_id = me.uid and c.user_id <> me.uid
    union all
    -- new top-level comments on your posts
    select c.id, 'comment', null, c.post_id, c.user_id, c.created_at, c.body
    from post_comments c
    join posts p on p.id = c.post_id
    , me
    where c.parent_id is null and p.user_id = me.uid and c.user_id <> me.uid
    union all
    -- your post expires soon: from 2 days before (or halfway through, for short posts),
    -- dated to that moment so it counts as new then
    select p.id, 'expiring', null, p.id, p.user_id, x.at, null
    from posts p
    cross join lateral (select greatest(p.expires_at - interval '2 days',
                                        p.created_at + (p.expires_at - p.created_at) / 2) as at) x
    , me
    where p.user_id = me.uid and p.expires_at > now() and x.at <= now()
    union all
    -- your post expired (shown for two weeks)
    select p.id, 'expired', null, p.id, p.user_id, p.expires_at, null
    from posts p, me
    where p.user_id = me.uid and p.expires_at <= now() and p.expires_at > now() - interval '14 days'
  ),
  -- same "Anonymous 1, 2, ..." numbering as post_comments_for
  numbered as (
    select c.post_id, c.user_id, row_number() over (partition by c.post_id order by min(c.created_at), c.user_id)::int as n
    from post_comments c
    join posts p on p.id = c.post_id
    where c.user_id <> p.user_id and c.post_id in (select post_id from events)
    group by c.post_id, c.user_id
  )
  select e.id, e.kind, e.created_at, e.body,
         numbered.n, e.user_id = r.user_id, e.your_comment,
         r.id, r.title, r.category, r.lat, r.lng,
         r.expires_at > now() and r.report_count < 3, r.comments_enabled,
         r.expires_at
  from events e
  join post_rows r on r.id = e.post_id
  left join numbered on numbered.post_id = e.post_id and numbered.user_id = e.user_id
  order by e.created_at desc
  limit 50;
$$;
revoke all on function public.notification_events() from public, anon, authenticated; -- internal

create function public.my_notifications()
returns table (
  id uuid, kind text, created_at timestamptz, body text,
  author_no integer, by_poster boolean, your_comment text,
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean, comments_enabled boolean, expires_at timestamptz, unread boolean
)
language sql stable
security definer
set search_path = public
as $$
  select e.*, e.created_at > coalesce(
           (select last_seen from notification_reads where user_id = auth.uid()), '-infinity')
  from notification_events() e;
$$;

create function public.unread_notification_count()
returns integer
language sql stable
security definer
set search_path = public
as $$
  select count(*)::int from notification_events() e
  where e.created_at > coalesce((select last_seen from notification_reads where user_id = auth.uid()), '-infinity');
$$;

revoke all on function public.my_notifications(), public.unread_notification_count() from public;
grant execute on function public.my_notifications(), public.unread_notification_count() to authenticated;

notify pgrst, 'reload schema';
