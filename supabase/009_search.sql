-- Search post text: posts whose title, details or category contain every word of the query,
-- closest to a point (the map's center) first. Same visibility rules as posts_in_view.
-- Safe to re-run.

drop function if exists public.search_posts(text, double precision, double precision);

create function public.search_posts(q text, near_lat double precision, near_lng double precision)
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
  with words as (
    -- strpos instead of LIKE, so %, _ and \ in the query are matched literally
    select distinct w from unnest(regexp_split_to_array(lower(btrim(q)), '\s+')) w where w <> ''
  )
  select r.id, r.title, r.body, r.category, r.image_path, r.lat, r.lng,
         r.created_at, r.expires_at, r.comments_enabled, r.save_count, r.comment_count,
         exists (select 1 from post_saves s where s.post_id = r.id and s.user_id = auth.uid()),
         coalesce(r.user_id = auth.uid(), false),
         false
  from post_rows r
  where length(btrim(q)) between 2 and 100
    and r.expires_at > now()
    and r.report_count < 3
    and not exists (select 1 from post_reports x where x.post_id = r.id and x.user_id = auth.uid())
    and not exists (
      select 1 from words
      where strpos(lower(r.title || ' ' || coalesce(r.body, '') || ' ' || r.category), words.w) = 0
    )
  order by r.location <-> st_setsrid(st_makepoint(near_lng, near_lat), 4326)::geography
  limit 30;
$$;

revoke all on function public.search_posts(text, double precision, double precision) from public;
grant execute on function public.search_posts(text, double precision, double precision) to anon, authenticated;

-- Make the API see the new function right away
notify pgrst, 'reload schema';
