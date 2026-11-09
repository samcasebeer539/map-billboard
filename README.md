# Map Billboard

A community billboard on a map. Click anywhere to pin a post; everyone sees posts in the area they're looking at.

**Stack (all free tiers):** Next.js + Tailwind · MapLibre GL JS · OpenFreeMap tiles (or MapTiler) · Supabase (Postgres + PostGIS) · Vercel

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Supabase project** (free) at [supabase.com](https://supabase.com).
   - Open **SQL Editor** and run, in order: `supabase/schema.sql`, `supabase/002_user_posts.sql`, `supabase/003_post_images.sql`, `supabase/004_post_duration.sql`, `supabase/005_saves.sql`.
   - Go to **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**. Each browser gets its own account automatically, which is what lets people manage their posts on the Profile page.
   - Go to **Project Settings → API** and copy the project URL and `anon` key.

3. **Environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in the Supabase values. The MapTiler key is optional; without it the map uses OpenFreeMap, which needs no key.

4. **Run it**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Deploy

Push to GitHub, import the repo on [Vercel](https://vercel.com), and add the same env vars in the project settings.

> Supabase pauses free projects after about a week of inactivity. Unpause it from the dashboard before you show the demo.

## How it works

- `components/BillboardMap.tsx`: the map. Posts are a GeoJSON circle layer, refetched whenever the view moves.
- `components/PostForm.tsx`: the form that opens when you click the map.
- `components/ImagePicker.tsx`: photo picker with preview. Photos are resized to 1600px WebP in the browser, then uploaded to the `post-images` Storage bucket under the user's own folder.
- `components/NavMenu.tsx`: the hamburger menu (Map, Profile, Settings).
- `app/profile`: your posts (edit, delete, view on map, save counts) and your saved posts.
- Saves: bookmark button with a count on each card, stored in `post_saves` (one row per user per post).
- `app/settings`: placeholder.
- `lib/supabase.ts`: the client plus the two calls the app makes.
- `supabase/schema.sql`: the `posts` table with a PostGIS `location` column and spatial index, and two functions:
  - `posts_in_view(min_lng, min_lat, max_lng, max_lat)`: live posts inside the current map bounds
  - `create_post(...)`: the only way to insert (validates coordinates; RLS blocks direct writes)
- Posters choose how long a post stays up (1 day to 3 months, default 1 month). Expiry dates show only on the Profile page.

## Ideas for next steps

- Auth (Supabase magic links) so posts have owners and can be edited or deleted
- Image uploads with Supabase Storage
- Clustering for dense areas (MapLibre has built-in GeoJSON clustering)
- Category filters and colored pins
- Realtime updates with Supabase Realtime
- Report button and rate limiting / Cloudflare Turnstile before going public
