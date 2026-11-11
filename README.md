# Map Billboard

A community billboard on a map. Click anywhere to pin a post; everyone sees posts in the area they're looking at.

**Stack (all free tiers):** Next.js + Tailwind · MapLibre GL JS · OpenFreeMap tiles (or MapTiler) · Supabase (Postgres + PostGIS) · Vercel

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Supabase project** (free) at [supabase.com](https://supabase.com).
   - Open **SQL Editor** and run, in order: `supabase/schema.sql`, `supabase/002_user_posts.sql`, `supabase/003_post_images.sql`, `supabase/004_post_duration.sql`, `supabase/005_saves.sql`, `supabase/006_edit_expiry.sql`, `supabase/007_comments_reports_limits.sql`, `supabase/008_email_accounts.sql`.
   - Go to **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**. Each browser gets its own account automatically, which is what lets people manage their posts on the Profile page.
   - Go to **Project Settings → API** and copy the project URL and `anon` key.

   - **Email sign-in:**
     - **Authentication → Sign In / Providers → Email:** leave it enabled.
     - **Authentication → URL Configuration:** set **Site URL** to where the app runs (e.g. `http://localhost:3000`) and add any other addresses you use (your Vercel URL, `http://192.168.x.x:3000`) to **Redirect URLs**. Email links land on `/settings`.
     - **Optional, Authentication → Emails → Templates:** to get a typed code as well as a link, add `{{ .Token }}` to the **Magic Link** and **Change Email Address** templates. The app accepts either.
     - Supabase's built-in email sender only delivers to your project's team members and is limited to a couple of emails per hour, which is fine for testing with your own address. For real users, connect a free SMTP provider (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

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
- `components/PostCard.tsx`: the card shown on the map (photo, text, date, save button).
- Zoomed out, nearby posts group into numbered bubbles. From `CARD_ZOOM` in, every post shows as a card. Clicking a dot zooms in to it.

**Posting**
- `components/PostForm.tsx`: the panel that opens when you click the map.
- `components/ImagePicker.tsx`: photo picker. Photos are resized to 1600px WebP in the browser, then uploaded to the `post-images` bucket under the user's own folder.
- Posters choose how long a post stays up (1 day to 3 months, default 1 month). Expiry dates only show on the Profile page.

**Comments, sharing and reports**
- Posters can turn on comments when creating or editing a post. `components/CommentsPanel.tsx` shows the thread; commenters appear as "You", "Poster" or "Anonymous" (user ids are never sent to the browser). Posters can delete any comment on their post.
- The share button copies a link (or opens the share sheet on phones) like `/?post=<id>&lat=..&lng=..`, which opens the map zoomed in with that card highlighted.
- The flag button (`components/ReportDialog.tsx`) reports a post. It's hidden for the reporter right away and for everyone at 3 reports. Review reports in Supabase → Table Editor → `post_reports`.
- Each person can have up to 10 active posts (enforced by a database trigger; expired and deleted posts don't count).

**Accounts**
- Everyone starts as a guest (an anonymous account in this browser). `components/AccountCard.tsx` in Settings lets them sign in with an email code or link (`lib/auth.ts`).
- A guest who adds a new email keeps the same account. If the email already has an account, the guest's posts, saves and comments move into it on sign-in (one-time transfer token, `supabase/008_email_accounts.sql`).

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
