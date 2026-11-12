-- Run this in Supabase → SQL Editor AFTER 010_comment_replies.sql. Safe to re-run.
-- 1. Replies remember the exact comment they answer (reply_to_id), so a reply to a reply
--    can show what it's responding to. parent_id still groups the thread.
-- 2. Commenters are numbered per post (Anonymous 1, 2, ...) in order of their first comment,
--    without sending any user ids to the browser.

alter table public.post_comments
  add column if not exists reply_to_id uuid references public.post_comments(id) on delete set null;

-- Same as 010, plus: when answering a reply, keep that reply in reply_to_id
-- (replies to a thread's top comment don't need it: their place in the thread says it)
create or replace function public.thread_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
begin
  new.reply_to_id := null; -- only ever set here
  if new.parent_id is null then
    return new;
  end if;
  select post_id, parent_id into parent from post_comments where id = new.parent_id;
  if not found or parent.post_id <> new.post_id then
    raise exception 'That comment is no longer there';
  end if;
  if parent.parent_id is not null then
    new.reply_to_id := new.parent_id;
    new.parent_id := parent.parent_id;
  end if;
  return new;
end;
$$;

drop function if exists public.post_comments_for(uuid);

create function public.post_comments_for(p_post_id uuid)
returns table (
  id uuid, parent_id uuid, reply_to_id uuid, body text, created_at timestamptz,
  mine boolean, by_poster boolean, can_delete boolean, author_no integer
)
language sql stable
security definer
set search_path = public
as $$
  with post as (
    select p.id, p.user_id from posts p
    where p.id = p_post_id and (p.expires_at > now() or p.user_id = auth.uid())
  ),
  -- everyone but the poster, numbered by when they first commented
  numbered as (
    select c.user_id, row_number() over (order by min(c.created_at), c.user_id)::int as n
    from post_comments c, post
    where c.post_id = post.id and c.user_id <> post.user_id
    group by c.user_id
  )
  select c.id, c.parent_id, c.reply_to_id, c.body, c.created_at,
         coalesce(c.user_id = auth.uid(), false),
         c.user_id = post.user_id,
         coalesce(c.user_id = auth.uid() or post.user_id = auth.uid(), false),
         numbered.n
  from post_comments c
  join post on post.id = c.post_id
  left join numbered on numbered.user_id = c.user_id
  order by c.created_at;
$$;

grant execute on function public.post_comments_for(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
