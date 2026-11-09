-- Run this in Supabase → SQL Editor AFTER 003_post_images.sql.
-- Lets the poster choose how long a post stays up (1 to 90 days, default 30).

drop function if exists public.create_post(text, text, text, double precision, double precision, text);

create function public.create_post(
  p_title text,
  p_body text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_image_path text default null,
  p_duration_days integer default 30
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

  insert into public.posts (title, body, category, location, user_id, image_path, expires_at)
  values (p_title, coalesce(p_body, ''), coalesce(p_category, 'general'),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, auth.uid(), p_image_path,
          now() + make_interval(days => p_duration_days))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.create_post from anon, public;
grant execute on function public.create_post to authenticated;
