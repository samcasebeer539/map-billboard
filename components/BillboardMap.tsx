"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GeoJSONSource, GeolocateControl, Map as MlMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchPostsInView, Post, supabase } from "@/lib/supabase";
import { ACCENTS, Theme } from "@/lib/settings";
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
      dark: "https://tiles.openfreemap.org/styles/dark",
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

// Built with DOM nodes + textContent so user-submitted text can't inject HTML
function popupContent(props: Record<string, string>): HTMLElement {
  const el = document.createElement("div");
  const cat = document.createElement("div");
  cat.className = "text-xs uppercase tracking-wide text-accent";
  cat.textContent = props.category;
  const title = document.createElement("div");
  title.className = "font-semibold";
  title.textContent = props.title;
  const body = document.createElement("p");
  body.className = "mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap";
  body.textContent = props.body;
  const date = document.createElement("div");
  date.className = "mt-2 text-xs text-gray-400";
  date.textContent = new Date(props.created_at).toLocaleDateString();
  el.append(cat, title, body, date);
  return el;
}

// Theme as currently applied to <html> (set before paint by the head script)
function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function currentAccentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || ACCENTS.orange;
}

export default function BillboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const styleThemeRef = useRef<Theme | null>(null);
  const postsRef = useRef<Post[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const { theme, accent, ready } = useSettings();

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
  }, []);

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
      map.addSource("posts", { type: "geojson", data: toGeoJSON(postsRef.current) });
      map.addLayer({
        id: "posts",
        type: "circle",
        source: "posts",
        paint: {
          "circle-radius": 8,
          "circle-color": currentAccentColor(),
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    });

    map.on("load", loadPosts);

    map.on("click", "posts", (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      new Popup({ offset: 12 })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(popupContent(f.properties as Record<string, string>))
        .addTo(map);
    });
    map.on("mouseenter", "posts", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "posts", () => (map.getCanvas().style.cursor = ""));

    // Clicking empty map drops a draft pin and opens the form
    map.on("click", (e) => {
      if (!map.getLayer("posts")) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ["posts"] });
      if (hit.length) return;
      setDraft({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // Refetch whenever the view changes
    map.on("moveend", loadPosts);

    return () => map.remove();
  }, [loadPosts]);

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
    if (map?.getLayer("posts")) map.setPaintProperty("posts", "circle-color", ACCENTS[accent]);
  }, [accent]);

  // Keep the draft marker in sync with draft state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = draft
      ? new Marker({ color: currentAccentColor() }).setLngLat([draft.lng, draft.lat]).addTo(map)
      : null;
  }, [draft, accent]);

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
