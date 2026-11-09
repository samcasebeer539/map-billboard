"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { fetchPostsInView, Post, supabase } from "@/lib/supabase";
import PostForm from "./PostForm";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/liberty"; // free, no key

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
  cat.className = "text-xs uppercase tracking-wide text-gray-500";
  cat.textContent = props.category;
  const title = document.createElement("div");
  title.className = "font-semibold text-gray-900";
  title.textContent = props.title;
  const body = document.createElement("p");
  body.className = "mt-1 text-sm text-gray-700 whitespace-pre-wrap";
  body.textContent = props.body;
  const date = document.createElement("div");
  date.className = "mt-2 text-xs text-gray-400";
  date.textContent = new Date(props.created_at).toLocaleDateString();
  el.append(cat, title, body, date);
  return el;
}

export default function BillboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const draftMarkerRef = useRef<Marker | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);

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
    (map.getSource("posts") as GeoJSONSource | undefined)?.setData(toGeoJSON(posts));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: START,
      zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");

    map.on("load", () => {
      map.addSource("posts", { type: "geojson", data: toGeoJSON([]) });
      map.addLayer({
        id: "posts",
        type: "circle",
        source: "posts",
        paint: {
          "circle-radius": 8,
          "circle-color": "#e8590c",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "posts", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setDOMContent(popupContent(f.properties as Record<string, string>))
          .addTo(map);
      });
      map.on("mouseenter", "posts", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "posts", () => (map.getCanvas().style.cursor = ""));

      loadPosts();
    });

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

  // Keep the draft marker in sync with draft state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = draft
      ? new maplibregl.Marker({ color: "#1c7ed6" }).setLngLat([draft.lng, draft.lat]).addTo(map)
      : null;
  }, [draft]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-4 py-3 shadow-md">
        <h1 className="text-lg font-bold text-gray-900">Map Billboard</h1>
        <p className="text-sm text-gray-600">Click anywhere on the map to post.</p>
        {!supabase && (
          <p className="mt-1 text-xs text-red-600">Supabase not configured. Posts won&apos;t save.</p>
        )}
      </div>

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
