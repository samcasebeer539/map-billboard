// Map configuration and the MapLibre layers that draw posts (dots and clusters).
// Cards are React components (components/PostCard.tsx) placed by BillboardMap.

import { Map as MlMap } from "maplibre-gl";
import type { Post } from "./supabase";
import { cssToken, Theme } from "./settings";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export const STYLE_URLS: Record<Theme, string> = MAPTILER_KEY
  ? {
      light: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      dark: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`,
    }
  : {
      // OpenFreeMap: free, no key
      light: "https://tiles.openfreemap.org/styles/liberty",
      dark: "https://tiles.openfreemap.org/styles/fiord",
    };

// Starting view: Sacramento. Change to wherever you want the demo to open.
export const START: [number, number] = [-121.4944, 38.5816];
export const START_ZOOM = 12;
export const FOCUS_ZOOM = 16; // used for "View on map" links

// At this zoom and closer, every post shows as a card; further out they are dots or groups
export const CARD_ZOOM = 14;

// How far (px) a card's bottom edge sits above its post's location, so the triangle
// points at the dot (8px radius + 2px border) instead of covering it.
export const CARD_LIFT = 14;

// Up to this zoom, nearby posts are grouped into numbered clusters.
// Always one level below CARD_ZOOM, so there's a dots-only zoom level in between.
const CLUSTER_MAX_ZOOM = CARD_ZOOM - 1;

export const SOURCE = "posts";
export const DOT_LAYER = "posts";
export const CLUSTER_LAYER = "post-clusters";
const CLUSTER_COUNT_LAYER = "post-cluster-count";

// The map only needs each post's location and id; card content comes from the Post objects
export function toGeoJSON(posts: Post[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: posts.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id },
    })),
  };
}

// Pin colors come from the same CSS tokens as the rest of the UI
export function applyPinColors(map: MlMap) {
  const fill = cssToken("--accent");
  const stroke = cssToken("--surface");
  for (const id of [DOT_LAYER, CLUSTER_LAYER]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "circle-color", fill);
    map.setPaintProperty(id, "circle-stroke-color", stroke);
  }
  if (map.getLayer(CLUSTER_COUNT_LAYER)) {
    map.setPaintProperty(CLUSTER_COUNT_LAYER, "text-color", cssToken("--on-accent"));
  }
}

// Adds the posts source plus cluster bubbles, cluster counts and single-post dots.
// Must be re-run after every style change, since setStyle() wipes custom layers.
export function addPostLayers(map: MlMap, posts: Post[]) {
  map.addSource(SOURCE, {
    type: "geojson",
    data: toGeoJSON(posts),
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
  });
  // Group bubbles, sized by how many posts they hold
  map.addLayer({
    id: CLUSTER_LAYER,
    type: "circle",
    source: SOURCE,
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: CLUSTER_COUNT_LAYER,
    type: "symbol",
    source: SOURCE,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
  });
  // Single posts
  map.addLayer({
    id: DOT_LAYER,
    type: "circle",
    source: SOURCE,
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": 8, "circle-stroke-width": 2 },
  });
  applyPinColors(map);
}
