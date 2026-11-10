-- Run this in Supabase → SQL Editor AFTER 005_saves.sql.
-- Lets owners change when their post expires (up to 90 days from now, same limit as new posts).

grant update (expires_at) on public.posts to authenticated;

drop policy if exists "update own posts" on public.posts;
create policy "update own posts" on public.posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (image_path is null or image_path like auth.uid()::text || '/%')
    -- small allowance for the browser's clock being slightly ahead of the server's
    and expires_at <= now() + interval '90 days' + interval '1 hour'
  );
