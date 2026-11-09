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
  lat: number;
  lng: number;
  created_at: string;
  expires_at: string;
};

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
}): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured yet. See the README.";
  const { error } = await supabase.rpc("create_post", {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
  });
  return error ? error.message : null;
}
