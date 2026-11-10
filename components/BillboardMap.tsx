"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { GeoJSONSource, GeolocateControl, Map as MlMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { fetchPostsInView, Post, setSaved } from "@/lib/supabase";
import { appliedTheme, cssToken, Theme } from "@/lib/settings";
import {
  addPostLayers,
  applyPinColors,
  CARD_LIFT,
  CARD_ZOOM,
  CLUSTER_LAYER,
  DOT_LAYER,
  FOCUS_ZOOM,
  SOURCE,
  START,
  START_ZOOM,
  STYLE_URLS,
  toGeoJSON,
} from "@/lib/mapLayers";
import { useSettings } from "./SettingsProvider";
import PostForm from "./PostForm";
import NavMenu from "./NavMenu";
import PostCard from "./PostCard";
import Lightbox, { LightboxImage } from "./Lightbox";

// MapLibre 6 runs tile parsing in a web worker. Bundlers can't resolve its default
// worker path, so we serve a copy from /public (copied there by scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre-gl-worker.mjs");

// One map marker per open card. Each marker holds its own React root rendering <PostCard>.
type CardEntry = { marker: Marker; root: Root; post: Post; render: () => void };

export default function BillboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const styleThemeRef = useRef<Theme | null>(null);
  const postsRef = useRef<Post[]>([]);
  const loadIdRef = useRef(0); // ignores responses from older, slower requests
  const draftMarkerRef = useRef<Marker | null>(null);
  const cardsRef = useRef(new Map<string, CardEntry>());

  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const { theme, accent, ready } = useSettings();
  const closeLightbox = useCallback(() => setLightbox(null), []);

  // Every post in view shows as a card once zoomed in to CARD_ZOOM; otherwise none do
  const syncCards = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const open = map.getZoom() >= CARD_ZOOM ? postsRef.current : [];
    const openIds = new Set(open.map((p) => p.id));
    const cards = cardsRef.current;

    for (const [id, card] of cards) {
      if (openIds.has(id)) continue;
      card.marker.remove();
      setTimeout(() => card.root.unmount()); // unmount outside React's render cycle
      cards.delete(id);
    }

    for (const p of open) {
      const existing = cards.get(p.id);
      if (existing) {
        existing.post = p; // fresh data from the server (edits, save counts)
        existing.render();
      } else {
        cards.set(p.id, createCard(map, p));
      }
    }

    function createCard(map: MlMap, p: Post): CardEntry {
      const el = document.createElement("div");
      // Bring the hovered card above its neighbours
      el.addEventListener("mouseenter", () => (el.style.zIndex = "1"));
      el.addEventListener("mouseleave", () => (el.style.zIndex = ""));
      const root = createRoot(el);

      // Optimistic save toggle: update right away, roll back if the server says no
      const toggleSave = async () => {
        const before = entry.post;
        const next = !before.saved;
        entry.post = { ...before, saved: next, save_count: before.save_count + (next ? 1 : -1) };
        entry.render();
        const err = await setSaved(p.id, next);
        if (err) {
          console.error("Couldn't update save:", err);
          entry.post = before;
          entry.render();
        }
      };

      const entry: CardEntry = {
        marker: new Marker({ element: el, anchor: "bottom", offset: [0, -CARD_LIFT] }).setLngLat([p.lng, p.lat]),
        root,
        post: p,
        render: () =>
          root.render(
            <PostCard
              post={entry.post}
              onExpand={(src, alt) => setLightbox({ src, alt })}
              onToggleSave={toggleSave}
            />
          ),
      };
      entry.render();
      entry.marker.addTo(map);
      return entry;
    }
  }, []);

  const loadPosts = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const loadId = ++loadIdRef.current;
    const b = map.getBounds();
    const posts = await fetchPostsInView({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    if (loadId !== loadIdRef.current) return; // the map moved again while this was loading
    postsRef.current = posts;
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(posts));
    syncCards();
  }, [syncCards]);

  // Create the map once
  useEffect(() => {
    if (!containerRef.current) return;

    // "View on map" links from the profile page pass ?lat=..&lng=..
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    const focus = Number.isFinite(lat) && Number.isFinite(lng);

    styleThemeRef.current = appliedTheme();
    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URLS[styleThemeRef.current],
      center: focus ? [lng, lat] : START,
      zoom: focus ? FOCUS_ZOOM : START_ZOOM,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-right");

    // Switching light/dark replaces the whole style, which wipes our layers,
    // so they're (re)added every time a style finishes loading.
    map.on("style.load", () => {
      if (map.getSource(SOURCE)) return;
      addPostLayers(map, postsRef.current);
      syncCards();
    });

    map.on("load", loadPosts);
    map.on("moveend", loadPosts);
    map.on("zoom", syncCards);

    // Clicking a dot zooms in on it until the cards appear
    map.on("click", DOT_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: Math.max(map.getZoom(), CARD_ZOOM) });
    });

    // Clicking a group zooms in far enough to split it apart
    map.on("click", CLUSTER_LAYER, async (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      try {
        const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: f.geometry.coordinates as [number, number], zoom });
      } catch (err) {
        console.error("Couldn't expand group:", err);
      }
    });

    for (const layer of [DOT_LAYER, CLUSTER_LAYER]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }

    // Clicking empty map drops a draft pin and opens the post form
    map.on("click", (e) => {
      if ((e.originalEvent.target as HTMLElement).closest(".post-card")) return;
      if (!map.getLayer(DOT_LAYER)) return;
      if (map.queryRenderedFeatures(e.point, { layers: [DOT_LAYER, CLUSTER_LAYER] }).length) return;
      setDraft({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    const cards = cardsRef.current;
    return () => {
      for (const card of cards.values()) setTimeout(() => card.root.unmount());
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
    if (mapRef.current) applyPinColors(mapRef.current);
  }, [accent]);

  // Show the draft pin while the post form is open
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

      {/* Menu button: top-left; slides beside the post form (sm+) or hides behind it on phones.
          left-99 = the form's 380px width + 16px gap */}
      <div className={`absolute top-4 z-20 transition-[left] duration-200 ${draft ? "left-4 max-sm:hidden sm:left-99" : "left-4"}`}>
        <NavMenu />
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

      <Lightbox image={lightbox} onClose={closeLightbox} />
    </>
  );
}
