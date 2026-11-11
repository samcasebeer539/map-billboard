import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Every data call the app makes lives in this file. Functions return an error
// message string (or null on success) so components can show it directly.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null when env vars aren't set, so the map still renders without a backend
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

const NOT_CONFIGURED = "Supabase isn't configured yet. See the README.";
const IMAGE_BUCKET = "post-images";

// ---------- Types and constants ----------

export type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  image_path: string | null;
  lat: number;
  lng: number;
  created_at: string;
  expires_at: string;
  comments_enabled: boolean;
  save_count: number;
  comment_count: number;
  saved: boolean; // saved by the current visitor
  mine: boolean; // posted by the current visitor
  hidden: boolean; // hidden from the map after 3 reports (only shown to the owner)
};

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  by_poster: boolean;
  can_delete: boolean;
};

export const REPORT_REASONS = {
  spam: "Spam or advertising",
  inappropriate: "Offensive or inappropriate",
  scam: "Scam or misleading",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

// Must match the database (supabase/*.sql)
export const TITLE_MAX = 80;
export const BODY_MAX = 500;
export const COMMENT_MAX = 300;
export const POST_LIMIT = 10; // active posts per person

export const CATEGORIES = ["general", "event", "lost & found", "for sale", "free", "help wanted", "service"] as const;
export type Category = (typeof CATEGORIES)[number];

// How long a new post stays up. Labels are what the form shows; values are days (server allows 1–90).
export const DURATIONS = {
  "1 day": 1,
  "3 days": 3,
  "1 week": 7,
  "2 weeks": 14,
  "1 month": 30,
  "3 months": 90,
} as const;
export type Duration = keyof typeof DURATIONS;
export const DEFAULT_DURATION: Duration = "1 month";

// ---------- Session ----------

// Returns a client with a signed-in session, signing the visitor in anonymously the first time.
// The session lives in this browser, so "your posts" = posts made from this browser.
async function signedIn(): Promise<{ db: SupabaseClient; error: null } | { db: null; error: string }> {
  if (!supabase) return { db: null, error: NOT_CONFIGURED };
  const { data } = await supabase.auth.getSession();
  if (data.session) return { db: supabase, error: null };
  const { error } = await supabase.auth.signInAnonymously();
  if (!error) return { db: supabase, error: null };
  return {
    db: null,
    error: error.message.toLowerCase().includes("anonymous")
      ? "Anonymous sign-ins are disabled. Turn them on in Supabase → Authentication → Sign In / Providers."
      : error.message,
  };
}

// Runs a list RPC that needs a session (my_posts, saved_posts)
async function fetchList(rpc: string): Promise<{ posts: Post[]; error: string | null }> {
  const { db, error: authError } = await signedIn();
  if (!db) return { posts: [], error: authError };
  const { data, error } = await db.rpc(rpc);
  return { posts: (data as Post[]) ?? [], error: error?.message ?? null };
}

// ---------- Posts ----------

// Live posts inside the map's current bounds. Doesn't need a session (anyone can browse).
export async function fetchPostsInView(bounds: { west: number; south: number; east: number; north: number }): Promise<Post[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("posts_in_view", {
    min_lng: bounds.west,
    min_lat: bounds.south,
    max_lng: bounds.east,
    max_lat: bounds.north,
  });
  if (error) {
    console.error("posts_in_view failed:", error.message);
    return [];
  }
  return data as Post[];
}

export const fetchMyPosts = () => fetchList("my_posts");

export async function createPost(input: {
  title: string;
  body: string;
  category: string;
  lat: number;
  lng: number;
  image: File | null;
  duration: Duration;
  commentsEnabled: boolean;
}): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;

  let imagePath: string | null = null;
  if (input.image) {
    const up = await uploadPostImage(db, input.image);
    if (up.error) return up.error;
    imagePath = up.path;
  }

  const { error } = await db.rpc("create_post", {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
    p_image_path: imagePath,
    p_duration_days: DURATIONS[input.duration],
    p_comments_enabled: input.commentsEnabled,
  });
  if (error && imagePath) await removeImage(db, imagePath); // don't leave an orphaned file
  return error?.message ?? null;
}

// image: undefined = keep current, null = remove, File = replace
// duration: undefined = keep the current expiry, otherwise expire that long from now
export async function updatePost(
  post: Post,
  changes: {
    title: string;
    body: string;
    category: string;
    commentsEnabled: boolean;
    image?: File | null;
    duration?: Duration;
  }
): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { image, duration, commentsEnabled, ...fields } = changes;
  const expiry = duration ? { expires_at: new Date(Date.now() + DURATIONS[duration] * 86_400_000).toISOString() } : {};

  let imagePath = post.image_path;
  if (image !== undefined) {
    imagePath = null;
    if (image) {
      const up = await uploadPostImage(db, image);
      if (up.error) return up.error;
      imagePath = up.path;
    }
  }

  const { error } = await db.from("posts").update({ ...fields, ...expiry, comments_enabled: commentsEnabled, image_path: imagePath }).eq("id", post.id);
  if (error) {
    if (imagePath && imagePath !== post.image_path) await removeImage(db, imagePath);
    return error.message;
  }
  if (post.image_path && post.image_path !== imagePath) await removeImage(db, post.image_path);
  return null;
}

export async function deletePost(post: Post): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { error } = await db.from("posts").delete().eq("id", post.id);
  if (error) return error.message;
  if (post.image_path) await removeImage(db, post.image_path);
  return null;
}

// ---------- Images ----------

export function imageUrl(path: string): string {
  return supabase?.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
}

// Shrinks photos to at most 1600px on the long side and re-encodes them as WebP,
// which typically turns a 4 MB phone photo into ~200 KB. GIFs are kept as-is so they still animate.
async function resizeImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const MAX = 1600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/webp", 0.85)
  );
}

// Uploads into the user's own folder (<user id>/<random>.webp), which the storage policies require
async function uploadPostImage(db: SupabaseClient, file: File): Promise<{ path: string | null; error: string | null }> {
  const { data } = await db.auth.getUser();
  if (!data.user) return { path: null, error: "You need to be signed in to upload images." };

  let blob: Blob;
  try {
    blob = await resizeImage(file);
  } catch {
    return { path: null, error: "That file couldn't be read as an image." };
  }
  const ext = blob.type === "image/gif" ? "gif" : "webp";
  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  return error ? { path: null, error: error.message } : { path, error: null };
}

async function removeImage(db: SupabaseClient, path: string) {
  await db.storage.from(IMAGE_BUCKET).remove([path]);
}

// ---------- Saves ----------

export const fetchSavedPosts = () => fetchList("saved_posts");

// Saves or unsaves a post for the current visitor
export async function setSaved(postId: string, saved: boolean): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { error } = saved
    ? await db.from("post_saves").insert({ post_id: postId })
    : await db.from("post_saves").delete().eq("post_id", postId);
  if (error?.code === "23505") return null; // already saved (e.g. two tabs open) — that's fine
  return error?.message ?? null;
}

// ---------- Comments ----------

// Readable without an account, so browsing comments doesn't sign anyone in
export async function fetchComments(postId: string): Promise<{ comments: Comment[]; error: string | null }> {
  if (!supabase) return { comments: [], error: NOT_CONFIGURED };
  const { data, error } = await supabase.rpc("post_comments_for", { p_post_id: postId });
  return { comments: (data as Comment[]) ?? [], error: error?.message ?? null };
}

export async function addComment(postId: string, body: string): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { error } = await db.from("post_comments").insert({ post_id: postId, body });
  return error?.message ?? null;
}

export async function deleteComment(commentId: string): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { data, error } = await db.rpc("delete_comment", { p_comment_id: commentId });
  if (error) return error.message;
  return data ? null : "You can't delete that comment.";
}

// ---------- Reports ----------

export async function reportPost(postId: string, reason: ReportReason): Promise<string | null> {
  const { db, error: authError } = await signedIn();
  if (!db) return authError;
  const { error } = await db.from("post_reports").insert({ post_id: postId, reason });
  if (error?.code === "23505") return null; // already reported by this person — fine
  return error?.message ?? null;
}

// ---------- Sharing ----------

// A link that opens the map zoomed in on this post, with its card highlighted
export function postLink(post: Pick<Post, "id" | "lat" | "lng">): string {
  const params = new URLSearchParams({ post: post.id, lat: post.lat.toFixed(6), lng: post.lng.toFixed(6) });
  return `${window.location.origin}/?${params}`;
}
