import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null when env vars aren't set, so the map still renders without a backend
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

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
};

const IMAGE_BUCKET = "post-images";

// How long a new post stays up. Labels are what the form shows; values are days.
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

export const CATEGORIES = ["general", "event", "lost & found", "for sale", "free", "help wanted"] as const;

export async function fetchPostsInView(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): Promise<Post[]> {
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

export async function createPost(input: {
  title: string;
  body: string;
  category: string;
  lat: number;
  lng: number;
  image: File | null;
  duration: Duration;
}): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured yet. See the README.";
  const authError = await ensureSession();
  if (authError) return authError;

  let imagePath: string | null = null;
  if (input.image) {
    const up = await uploadPostImage(input.image);
    if (up.error) return up.error;
    imagePath = up.path;
  }

  const { error } = await supabase.rpc("create_post", {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
    p_image_path: imagePath,
    p_duration_days: DURATIONS[input.duration],
  });
  if (error && imagePath) await removeImage(imagePath); // don't leave an orphaned file
  return error ? error.message : null;
}

// ---------- Images ----------

export function imageUrl(path: string): string {
  if (!supabase) return "";
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
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
export async function uploadPostImage(file: File): Promise<{ path: string | null; error: string | null }> {
  if (!supabase) return { path: null, error: "Supabase isn't configured yet." };
  const authError = await ensureSession();
  if (authError) return { path: null, error: authError };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { path: null, error: "You need to be signed in to upload images." };

  let blob: Blob;
  try {
    blob = await resizeImage(file);
  } catch {
    return { path: null, error: "That file couldn't be read as an image." };
  }
  const ext = blob.type === "image/gif" ? "gif" : "webp";
  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  return error ? { path: null, error: error.message } : { path, error: null };
}

async function removeImage(path: string) {
  await supabase?.storage.from(IMAGE_BUCKET).remove([path]);
}

// Signs the visitor in anonymously the first time they need an account.
// The session lives in this browser, so "your posts" = posts made from this browser.
// Returns an error message, or null on success.
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured yet. See the README.";
  const { data } = await supabase.auth.getSession();
  if (data.session) return null;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    return error.message.toLowerCase().includes("anonymous")
      ? "Anonymous sign-ins are disabled. Turn them on in Supabase → Authentication → Sign In / Providers."
      : error.message;
  }
  return null;
}

export async function fetchMyPosts(): Promise<{ posts: Post[]; error: string | null }> {
  if (!supabase) return { posts: [], error: "Supabase isn't configured yet. See the README." };
  const authError = await ensureSession();
  if (authError) return { posts: [], error: authError };
  const { data, error } = await supabase.rpc("my_posts");
  return { posts: (data as Post[]) ?? [], error: error?.message ?? null };
}

// image: undefined = keep current, null = remove, File = replace
export async function updatePost(
  post: Post,
  changes: { title: string; body: string; category: string; image?: File | null }
): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured yet.";
  const { image, ...fields } = changes;

  let imagePath = post.image_path;
  if (image !== undefined) {
    imagePath = null;
    if (image) {
      const up = await uploadPostImage(image);
      if (up.error) return up.error;
      imagePath = up.path;
    }
  }

  const { error } = await supabase
    .from("posts")
    .update({ ...fields, image_path: imagePath })
    .eq("id", post.id);
  if (error) {
    if (imagePath && imagePath !== post.image_path) await removeImage(imagePath);
    return error.message;
  }
  if (post.image_path && post.image_path !== imagePath) await removeImage(post.image_path);
  return null;
}

export async function deletePost(post: Post): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured yet.";
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) return error.message;
  if (post.image_path) await removeImage(post.image_path);
  return null;
}
