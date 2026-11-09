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

**Map**
- `components/BillboardMap.tsx`: creates the map, loads posts for the current view, and decides which posts show as cards.
- `lib/mapLayers.ts`: map styles, zoom thresholds (`CARD_ZOOM`, `CARD_LIFT`) and the MapLibre layers for dots and groups.
- `components/PostCard.tsx`: the card shown on the map (photo, text, date, save button, × to minimize).
- Zoomed out, nearby posts group into numbered bubbles. From `CARD_ZOOM` in, every post shows as a card. Clicking a dot opens its card at any zoom.

**Posting**
- `components/PostForm.tsx`: the panel that opens when you click the map.
- `components/ImagePicker.tsx`: photo picker. Photos are resized to 1600px WebP in the browser, then uploaded to the `post-images` bucket under the user's own folder.
- Posters choose how long a post stays up (1 day to 3 months, default 1 month). Expiry dates only show on the Profile page.

**Profile and settings**
- `components/ProfileTabs.tsx`: switches between `MyPosts` (edit, delete, save counts) and `SavedPosts`.
- `components/SettingsForm.tsx`: dark mode and accent color, stored in the browser (`lib/settings.ts`).

**Shared pieces**
- `app/globals.css`: color tokens (light/dark), the type scale and shared classes (`card`, `input`, `btn-*`, `field-label`).
- `components/Field.tsx`, `Select.tsx`, `Lightbox.tsx`, `PostSummary.tsx`, `PostList.tsx`: form field, dropdown, photo viewer and Profile list building blocks.

**Data**
- `lib/supabase.ts`: every call the app makes. Visitors are signed in anonymously the first time they post or save.
- `supabase/*.sql`: run in order. Posts are only created through `create_post()` and all tables use row-level security, so people can only change their own posts, photos and saves.

## Ideas for next steps

- Email sign-in (Supabase magic links) so posts follow you across devices
- More than one photo per post
- Category filters and colored pins
- Realtime updates with Supabase Realtime
- Report button and rate limiting / Cloudflare Turnstile before going public
