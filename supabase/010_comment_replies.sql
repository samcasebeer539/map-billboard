-- Run this in Supabase → SQL Editor AFTER 009_search.sql.
-- Adds replies to comments, one level deep: replying to a reply joins the same thread.
-- Deleting a comment also deletes its replies. Safe to re-run.

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;
create index if not exists post_comments_parent_id_idx on public.post_comments (parent_id);

-- Before a reply is saved: the comment it answers must be on the same post, and a reply
-- to a reply is attached to the top comment of that thread instead.
create or replace function public.thread_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select post_id, parent_id into parent from post_comments where id = new.parent_id;
  if not found or parent.post_id <> new.post_id then
    raise exception 'That comment is no longer there';
  end if;
  new.parent_id := coalesce(parent.parent_id, new.parent_id);
  return new;
end;
$$;

drop trigger if exists post_comments_thread on public.post_comments;
create trigger post_comments_thread
  before insert on public.post_comments
  for each row execute function public.thread_comment_reply();

-- Same as before, plus parent_id (new column, so drop and recreate)
drop function if exists public.post_comments_for(uuid);

create function public.post_comments_for(p_post_id uuid)
returns table (id uuid, parent_id uuid, body text, created_at timestamptz, mine boolean, by_poster boolean, can_delete boolean)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.parent_id, c.body, c.created_at,
         coalesce(c.user_id = auth.uid(), false),
         c.user_id = p.user_id,
         coalesce(c.user_id = auth.uid() or p.user_id = auth.uid(), false)
  from post_comments c
  join posts p on p.id = c.post_id
  where c.post_id = p_post_id
    and (p.expires_at > now() or p.user_id = auth.uid())
  order by c.created_at;
$$;

grant execute on function public.post_comments_for(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
