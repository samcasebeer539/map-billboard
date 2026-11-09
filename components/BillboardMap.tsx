"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GeoJSONSource, GeolocateControl, Map as MlMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchPostsInView, Post, supabase } from "@/lib/supabase";
import { cssToken, Theme } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";
import PostForm from "./PostForm";
import NavMenu from "./NavMenu";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE_URLS: Record<Theme, string> = MAPTILER_KEY
  ? {
      light: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      dark: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`,
    }
  : {
      // OpenFreeMap: free, no key
      light: "https://tiles.openfreemap.org/styles/liberty",
      dark: "https://tiles.openfreemap.org/styles/fiord",
    };

// MapLibre 6 runs tile parsing in a web worker. Bundlers can't resolve its default
// worker path, so we serve a copy from /public (copied there by scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre-gl-worker.mjs");

// Starting view: Sacramento. Change to wherever you want the demo to open.
const START: [number, number] = [-121.4944, 38.5816];

function toGeoJSON(posts: Post[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: posts.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, title: p.title, body: p.body, category: p.category, created_at: p.created_at },
    })),
  };
}

// Post content (category, title, body, date) as DOM nodes. Built with textContent
// so user-submitted text can't inject HTML. Used by both popups and zoomed-in cards.
function postContent(p: Pick<Post, "category" | "title" | "body" | "created_at">, opts = { closeButton: false }): HTMLElement {
  const el = document.createElement("div");
  const cat = document.createElement("div");
  cat.className = "text-xs font-medium uppercase tracking-wide text-accent";
  cat.textContent = p.category;
  const title = document.createElement("div");
  title.className = `mt-1 text-sm font-semibold ${opts.closeButton ? "pr-4" : ""}`;
  title.textContent = p.title;
  const body = document.createElement("p");
  body.className = "mt-1 whitespace-pre-wrap break-words text-sm text-muted";
  body.textContent = p.body;
  const date = document.createElement("div");
  date.className = "mt-2 text-xs text-muted";
  date.textContent = new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  el.append(cat, title);
  if (p.body) el.append(body);
  el.append(date);
  return el;
}

// Zoomed-in view: a card with a small triangle pointing at the post's location
function cardElement(p: Post): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "post-card flex flex-col items-center";
  const card = document.createElement("div");
  card.className = "floating w-60 rounded-xl p-3";
  card.append(postContent(p));
  const tip = document.createElement("div");
  tip.className = "card-tip";
  wrap.append(card, tip);
  // Bring the hovered card above its neighbours
  wrap.addEventListener("mouseenter", () => (wrap.style.zIndex = "1"));
  wrap.addEventListener("mouseleave", () => (wrap.style.zIndex = ""));
  return wrap;
}

// At this zoom and closer, posts show as full cards instead of dots
const CARD_ZOOM = 14;

// Up to this zoom, nearby posts are grouped into numbered clusters.
// Always one level below CARD_ZOOM, so there's a dots-only zoom level in between.
const CLUSTER_MAX_ZOOM = CARD_ZOOM - 1;
const POST_LAYERS = ["post-clusters", "post-cluster-count", "posts"];

// Pin colors come from the same CSS tokens as the rest of the UI
function applyPinColors(map: MlMap) {
  const fill = cssToken("--accent");
  const stroke = cssToken("--surface");
  for (const id of ["posts", "post-clusters"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "circle-color", fill);
    map.setPaintProperty(id, "circle-stroke-color", stroke);
  }
  if (map.getLayer("post-cluster-count")) map.setPaintProperty("post-cluster-count", "text-color", cssToken("--on-accent"));
}

function addPostLayers(map: MlMap, data: GeoJSON.FeatureCollection) {
  map.addSource("posts", {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
  });
  // Group bubbles, sized by how many posts they hold
  map.addLayer({
    id: "post-clusters",
    type: "circle",
    source: "posts",
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: "post-cluster-count",
    type: "symbol",
    source: "posts",
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
    id: "posts",
    type: "circle",
    source: "posts",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": 8, "circle-stroke-width": 2 },
  });
  applyPinColors(map);
}

// Theme as currently applied to <html> (set before paint by the head script)
function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}


export default function BillboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const styleThemeRef = useRef<Theme | null>(null);
  const postsRef = useRef<Post[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null); // the open dot popup, if any
  const cardsRef = useRef(new Map<string, Marker>()); // key: id + content, so edits re-render
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const { theme, accent, ready } = useSettings();

  // Show cards when zoomed in, dots when zoomed out
  const syncCards = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const showCards = map.getZoom() >= CARD_ZOOM;
    for (const id of POST_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showCards ? "none" : "visible");
    }

    // Cards replace popups, so close any open one to avoid showing the post twice
    if (showCards) {
      popupRef.current?.remove();
      popupRef.current = null;
    }

    const cards = cardsRef.current;
    if (!showCards) {
      cards.forEach((m) => m.remove());
      cards.clear();
      return;
    }
    const wanted = new Map(postsRef.current.map((p) => [`${p.id}|${p.category}|${p.title}|${p.body}`, p]));
    for (const [key, marker] of cards) {
      if (!wanted.has(key)) {
        marker.remove();
        cards.delete(key);
      }
    }
    for (const [key, p] of wanted) {
      if (cards.has(key)) continue;
      const marker = new Marker({ element: cardElement(p), anchor: "bottom", offset: [0, -3] })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      cards.set(key, marker);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const posts = await fetchPostsInView({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
    postsRef.current = posts;
    (map.getSource("posts") as GeoJSONSource | undefined)?.setData(toGeoJSON(posts));
    syncCards();
  }, [syncCards]);

  useEffect(() => {
    if (!containerRef.current) return;

    // "View on map" links from the profile page pass ?lat=..&lng=..
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    const focus = Number.isFinite(lat) && Number.isFinite(lng);

    const initialTheme = currentTheme();
    styleThemeRef.current = initialTheme;

    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URLS[initialTheme],
      center: focus ? [lng, lat] : START,
      zoom: focus ? 16 : 12,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-right");

    // Switching light/dark replaces the whole style, which wipes our layer,
    // so the posts layer is (re)added every time a style finishes loading.
    map.on("style.load", () => {
      if (map.getSource("posts")) return;
      addPostLayers(map, toGeoJSON(postsRef.current));
      syncCards();
    });

    map.on("load", loadPosts);
    map.on("zoom", syncCards);

    map.on("click", "posts", (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      popupRef.current?.remove();
      popupRef.current = new Popup({ offset: 12 })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(postContent(f.properties as Post, { closeButton: true }))
        .addTo(map);
    });
    // Clicking a group zooms in far enough to split it apart
    map.on("click", "post-clusters", async (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const source = map.getSource("posts") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom });
    });

    for (const layer of ["posts", "post-clusters"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }

    // Clicking empty map drops a draft pin and opens the form
    map.on("click", (e) => {
      if ((e.originalEvent.target as HTMLElement).closest(".post-card")) return; // clicked a card
      if (!map.getLayer("posts")) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ["posts", "post-clusters"] });
      if (hit.length) return;
      setDraft({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // Refetch whenever the view changes
    map.on("moveend", loadPosts);

    const cards = cardsRef.current;
    return () => {
      cards.clear();
      map.remove();
    };
  }, [loadPosts, syncCards]);

  // Swap the basemap when the theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || styleThemeRef.current === theme) return;
    styleThemeRef.current = theme;
    map.setStyle(STYLE_URLS[theme], { diff: false });
  }, [theme, ready]);

  // Recolor pins when the accent changes
  useEffect(() => {
    const map = mapRef.current;
    if (map) applyPinColors(map);
  }, [accent]);

  // Keep the draft marker in sync with draft state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = draft
      ? new Marker({ color: cssToken("--accent") }).setLngLat([draft.lng, draft.lat]).addTo(map)
      : null;
  }, [draft, accent, theme]);

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />

      {/* Menu button: sits top-left, slides right when the post form is open */}
      <div
        className={`absolute top-4 z-20 transition-[left] duration-200 ${
          draft ? "left-[calc(min(92vw,380px)+1rem)]" : "left-4"
        }`}
      >
        <NavMenu />
      </div>

      {/* <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-4 py-3 shadow-md">
        <h1 className="text-lg font-bold text-gray-900">Map Billboard</h1>
        <p className="text-sm text-gray-600">Click anywhere on the map to post.</p>
        {!supabase && (
          <p className="mt-1 text-xs text-red-600">Supabase not configured. Posts won&apos;t save.</p>
        )}
      </div> */}

      {draft && (
        <PostForm
          location={draft}
          onCancel={() => setDraft(null)}
          onPosted={() => {
            setDraft(null);
            loadPosts();
          }}
        />
      )}
    </>
  );
}
