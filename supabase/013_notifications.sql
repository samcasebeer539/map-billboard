-- Run this in Supabase → SQL Editor AFTER 012_my_comments.sql. Safe to re-run.
-- In-app notifications, worked out from comments (no notification table to keep in sync):
--   * someone replied to your comment (directly, or in the thread under your top comment)
--   * someone commented on your post
-- Each account stores when it last opened Notifications; anything newer is unread.
-- Also adds reply counts to my_comments (Profile → Comments).

create table if not exists public.notification_reads (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon, authenticated; -- only through the functions below

-- The events for the current user, newest first (shared by the list and the unread count)
create or replace function public.notification_events()
returns table (
  id uuid, kind text, created_at timestamptz, body text,
  author_no integer, by_poster boolean,
  your_comment text,          -- for replies: the comment of yours they answered
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean, comments_enabled boolean
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
         r.expires_at > now() and r.report_count < 3, r.comments_enabled
  from events e
  join post_rows r on r.id = e.post_id
  left join numbered on numbered.post_id = e.post_id and numbered.user_id = e.user_id
  order by e.created_at desc
  limit 50;
$$;
revoke all on function public.notification_events() from public, anon, authenticated; -- internal

-- The list, with which ones are new since you last looked
create or replace function public.my_notifications()
returns table (
  id uuid, kind text, created_at timestamptz, body text,
  author_no integer, by_poster boolean, your_comment text,
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean, comments_enabled boolean, unread boolean
)
language sql stable
security definer
set search_path = public
as $$
  select e.*, e.created_at > coalesce(
           (select last_seen from notification_reads where user_id = auth.uid()), '-infinity')
  from notification_events() e;
$$;

-- For the dot on the menu button
create or replace function public.unread_notification_count()
returns integer
language sql stable
security definer
set search_path = public
as $$
  select count(*)::int from notification_events() e
  where e.created_at > coalesce((select last_seen from notification_reads where user_id = auth.uid()), '-infinity');
$$;

-- Opening Notifications marks everything up to now as read
create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  insert into notification_reads (user_id, last_seen) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen = excluded.last_seen;
$$;

revoke all on function public.my_notifications(), public.unread_notification_count(), public.mark_notifications_read() from public;
grant execute on function public.my_notifications(), public.unread_notification_count(), public.mark_notifications_read() to authenticated;

-- Profile → Comments: same as 012, plus how many replies each comment has
-- (top comments: replies in their thread; replies: replies that answer them)
drop function if exists public.my_comments();

create function public.my_comments()
returns table (
  id uuid, body text, created_at timestamptz, is_reply boolean,
  post_id uuid, post_title text, post_category text,
  lat double precision, lng double precision,
  post_live boolean, comments_enabled boolean, reply_count integer
)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.body, c.created_at, c.parent_id is not null,
         r.id, r.title, r.category, r.lat, r.lng,
         r.expires_at > now() and r.report_count < 3,
         r.comments_enabled,
         (select count(*)::int from post_comments x
          where case when c.parent_id is null then x.parent_id = c.id else x.reply_to_id = c.id end)
  from post_comments c
  join post_rows r on r.id = c.post_id
  where c.user_id = auth.uid()
  order by c.created_at desc;
$$;

revoke all on function public.my_comments() from public;
grant execute on function public.my_comments() to authenticated;

notify pgrst, 'reload schema';
