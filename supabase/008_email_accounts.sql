-- Run this in Supabase → SQL Editor AFTER 007_comments_reports_limits.sql.
-- Supports email sign-in on top of guest (anonymous) accounts:
--  * A guest who adds an email keeps the same account, so nothing needs to move.
--  * A guest who signs in to an email that already has an account would otherwise
--    lose their guest posts. Before signing in, the guest gets a one-time transfer
--    token; after signing in, the token moves their posts, saves, comments and
--    reports into the email account.

create table if not exists public.guest_transfers (
  token      uuid primary key default gen_random_uuid(),
  guest_id   uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '1 day'
);

-- Which guest accounts have been merged into which email accounts.
-- Photos stay in the guest's storage folder, so ownership checks consult this.
create table if not exists public.merged_accounts (
  user_id  uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null,
  merged_at timestamptz not null default now(),
  primary key (user_id, guest_id)
);

-- Only reachable through the functions below
alter table public.guest_transfers enable row level security;
alter table public.merged_accounts enable row level security;
revoke all on public.guest_transfers, public.merged_accounts from anon, authenticated;

-- True if a storage path is in the caller's folder, or the folder of a guest account merged into theirs
create or replace function public.owns_image_path(path text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    split_part(path, '/', 1) = auth.uid()::text
    or exists (select 1 from merged_accounts m
               where m.user_id = auth.uid() and m.guest_id::text = split_part(path, '/', 1))
  );
$$;
grant execute on function public.owns_image_path to authenticated;

-- Owners can still edit posts whose photo lives in a merged guest folder
drop policy if exists "update own posts" on public.posts;
create policy "update own posts" on public.posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (image_path is null or public.owns_image_path(image_path))
    -- small allowance for the browser's clock being slightly ahead of the server's
    and expires_at <= now() + interval '90 days' + interval '1 hour'
  );

-- ...and delete those photo files when replacing or deleting
drop policy if exists "delete own post images" on storage.objects;
create policy "delete own post images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and public.owns_image_path(name));

-- Step 1 (as the guest, before signing in): get a one-time token for this guest account
create or replace function public.create_guest_transfer()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false then
    raise exception 'Only guest accounts can be transferred';
  end if;
  delete from guest_transfers where guest_id = auth.uid() or expires_at < now();
  insert into guest_transfers (guest_id) values (auth.uid()) returning token into t;
  return t;
end;
$$;

-- Step 2 (after signing in to the email account): move everything over.
-- Returns how many posts were moved. Each token works once.
create or replace function public.claim_guest_transfer(p_token uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  guest uuid;
  moved integer;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with your email first';
  end if;

  delete from guest_transfers
  where token = p_token and expires_at > now()
  returning guest_id into guest;
  if guest is null or guest = auth.uid() then
    return 0; -- unknown, expired, already used, or nothing to move
  end if;

  update posts set user_id = auth.uid() where user_id = guest;
  get diagnostics moved = row_count;

  update post_comments set user_id = auth.uid() where user_id = guest;

  -- One save/report per person per post: keep the email account's if both exist
  insert into post_saves (user_id, post_id, created_at)
    select auth.uid(), post_id, created_at from post_saves where user_id = guest
    on conflict do nothing;
  delete from post_saves where user_id = guest;

  insert into post_reports (user_id, post_id, reason, created_at)
    select auth.uid(), post_id, reason, created_at from post_reports where user_id = guest
    on conflict do nothing;
  delete from post_reports where user_id = guest;

  insert into merged_accounts (user_id, guest_id) values (auth.uid(), guest) on conflict do nothing;
  -- guests merged into the guest (unlikely) come along too
  insert into merged_accounts (user_id, guest_id)
    select auth.uid(), m.guest_id from merged_accounts m where m.user_id = guest
    on conflict do nothing;

  return moved;
end;
$$;

revoke execute on function public.create_guest_transfer, public.claim_guest_transfer from anon, public;
grant execute on function public.create_guest_transfer, public.claim_guest_transfer to authenticated;
