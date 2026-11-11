"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { GeoJSONSource, GeolocateControl, Map as MlMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { fetchPostsInView, Post, postLink, setSaved } from "@/lib/supabase";
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
import CommentsPanel from "./CommentsPanel";
import ReportDialog from "./ReportDialog";
import Toast from "./Toast";

// MapLibre 6 runs tile parsing in a web worker. Bundlers can't resolve its default
// worker path, so we serve a copy from /public (copied there by scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre-gl-worker.mjs");

// One map marker per open card. Each marker holds its own React root rendering <PostCard>.
type CardEntry = { marker: Marker; root: Root; post: Post; render: () => void };

// How close (px) a click must be to a dot or group to count as clicking it.
// Bigger on touch screens, where a fingertip covers far more than an 8px dot.
const HIT_RADIUS = { mouse: 12, touch: 22 };

// The dot or group closest to a screen point, within HIT_RADIUS (groups get extra room for their size)
function nearestPostFeature(map: MlMap, point: { x: number; y: number }) {
  const r = window.matchMedia("(pointer: coarse)").matches ? HIT_RADIUS.touch : HIT_RADIUS.mouse;
  const hits = map.queryRenderedFeatures(
    [
      [point.x - r - 10, point.y - r - 10],
      [point.x + r + 10, point.y + r + 10],
    ],
    { layers: [CLUSTER_LAYER, DOT_LAYER] }
  );
  let best: (typeof hits)[number] | null = null;
  let bestDist = Infinity;
  for (const f of hits) {
    if (f.geometry.type !== "Point") continue;
    const p = map.project(f.geometry.coordinates as [number, number]);
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    const reach = r + (f.layer.id === CLUSTER_LAYER ? 10 : 0);
    if (d <= reach && d < bestDist) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

// Posts are loaded for more than the visible area, so cards don't vanish the moment their
// dot leaves the screen and nearby posts are already there when you pan to them.
const LOAD_MARGIN = 0.5; // extra area on every side, as a fraction of the visible area
const CARD_MAX_HEIGHT = 480; // tallest card (320px photo + text) + lift: dots this far off-screen still show cards

// Works for flat, rotated and tilted maps. Screen points above the horizon (which a tilted
// map's padding would reach) can't be turned back into map coordinates, so instead of padding
// in screen pixels, take MapLibre's visible bounds and pad them in degrees.
function paddedBounds(map: MlMap) {
  const b = map.getBounds();
  const lngPad = (b.getEast() - b.getWest()) * LOAD_MARGIN;
  const latPad = (b.getNorth() - b.getSouth()) * LOAD_MARGIN;

  // Cards hang above their dot, so also reach one card-height past the screen edge.
  // Measured at the bottom of the screen (closest to the viewer, so always on the map).
  const { clientWidth: w, clientHeight: h } = map.getCanvas();
  const bottom = map.unproject([w / 2, h]);
  const above = map.unproject([w / 2, Math.max(0, h - CARD_MAX_HEIGHT)]);
  const cardPad = Math.abs(above.lat - bottom.lat) + Math.abs(above.lng - bottom.lng);

  return {
    west: Math.max(-180, b.getWest() - lngPad - cardPad),
    east: Math.min(180, b.getEast() + lngPad + cardPad),
    south: Math.max(-85, b.getSouth() - latPad - cardPad),
    north: Math.min(85, b.getNorth() + latPad + cardPad),
  };
}

const HOVER_Z = 10_000; // above any stacking value below

// Overlapping cards: the one whose post sits lower on screen is in front (like objects
// nearer the viewer). Uses screen position, so it stays right if the map is rotated.
// Equal heights fall back to newest in front.
function stackCards(map: MlMap, cards: Map<string, CardEntry>) {
  const ordered = [...cards.values()].sort(
    (a, b) =>
      map.project([a.post.lng, a.post.lat]).y - map.project([b.post.lng, b.post.lat]).y ||
      a.post.created_at.localeCompare(b.post.created_at)
  );
  ordered.forEach((card, i) => {
    const el = card.marker.getElement();
    el.dataset.z = String(i + 1);
    if (el.style.zIndex !== String(HOVER_Z)) el.style.zIndex = el.dataset.z; // don't drop a hovered card
  });
}

export default function BillboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const styleThemeRef = useRef<Theme | null>(null);
  const postsRef = useRef<Post[]>([]);
  const loadIdRef = useRef(0); // ignores responses from older, slower requests
  const draftMarkerRef = useRef<Marker | null>(null);
  const cardsRef = useRef(new Map<string, CardEntry>());
  const highlightRef = useRef<string | null>(null); // post id from a share link

  // Only one side panel at a time: the new-post form (draft) or a post's comments
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [reporting, setReporting] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { theme, accent, ready } = useSettings();
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeToast = useCallback(() => setToast(null), []);
  const closeReport = useCallback(() => setReporting(null), []);
  const commentsPostId = commentsPost?.id;

  // Change one post locally (e.g. a new comment count) and redraw its card
  const patchPost = useCallback((id: string, patch: Partial<Post>) => {
    postsRef.current = postsRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const card = cardsRef.current.get(id);
    if (card) {
      card.post = { ...card.post, ...patch };
      card.render();
    }
  }, []);

  // Stable, so the comments panel doesn't reload on every render
  const updateCommentCount = useCallback(
    (n: number) => commentsPostId && patchPost(commentsPostId, { comment_count: n }),
    [commentsPostId, patchPost]
  );

  // Phones get the native share sheet; elsewhere the link is copied
  async function sharePost(p: Post) {
    const url = postLink(p);
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: p.title, url });
      } catch {
        /* closed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast("Couldn't copy the link");
    }
  }

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
    stackCards(map, cards);

    function createCard(map: MlMap, p: Post): CardEntry {
      const el = document.createElement("div");
      // The hovered card jumps above everything, then drops back to its place in the stack
      el.addEventListener("mouseenter", () => (el.style.zIndex = String(HOVER_Z)));
      el.addEventListener("mouseleave", () => (el.style.zIndex = el.dataset.z ?? ""));
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
              highlighted={entry.post.id === highlightRef.current}
              onExpand={(src, alt) => setLightbox({ src, alt })}
              onToggleSave={toggleSave}
              onOpenComments={() => {
                setDraft(null);
                setCommentsPost(entry.post);
              }}
              onShare={() => sharePost(entry.post)}
              onReport={() => setReporting(entry.post)}
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
    const posts = await fetchPostsInView(paddedBounds(map));
    if (loadId !== loadIdRef.current) return; // the map moved again while this was loading
    postsRef.current = posts;
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(posts));
    syncCards();
  }, [syncCards]);

  // Create the map once
  useEffect(() => {
    if (!containerRef.current) return;

    // "View on map" and share links pass ?lat=..&lng=.. (share links also ?post=<id> to highlight it)
    const params = new URLSearchParams(window.location.search);
    highlightRef.current = params.get("post");
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    const focus = Number.isFinite(lat) && Number.isFinite(lng);

    styleThemeRef.current = appliedTheme();
    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URLS[styleThemeRef.current],
      center: focus ? [lng, lat] : START,
      zoom: focus ? FOCUS_ZOOM : START_ZOOM,
      clickTolerance: 6, // px of movement still treated as a click/tap, not a drag (default 3)
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
    map.on("dragstart", () => {
      if (!highlightRef.current) return;
      highlightRef.current = null;
      for (const card of cardsRef.current.values()) card.render();
    });
    map.on("moveend", loadPosts);
    map.on("zoom", syncCards);

    // Pointer cursor near dots and groups, using the same forgiving radius as clicks
    map.on("mousemove", (e) => {
      map.getCanvas().style.cursor = nearestPostFeature(map, e.point) ? "pointer" : "";
    });

    // One click handler for the whole map:
    //  - near a group: zoom in until it splits
    //  - near a dot: zoom in until its card appears
    //  - otherwise: drop a draft pin and open the post form
    map.on("click", async (e) => {
      if ((e.originalEvent.target as HTMLElement).closest(".post-card")) return;
      if (!map.getLayer(DOT_LAYER)) return; // layers not ready yet

      const f = nearestPostFeature(map, e.point);
      if (!f) {
        setCommentsPost(null);
        setDraft({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        return;
      }
      const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      if (f.layer.id === CLUSTER_LAYER) {
        try {
          const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center, zoom });
        } catch (err) {
          console.error("Couldn't expand group:", err);
        }
      } else {
        map.easeTo({ center, zoom: Math.max(map.getZoom(), CARD_ZOOM) });
      }
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
      {/* isolate: card z-indexes (up to HOVER_Z) only compete inside the map,
          so they can never cover the menu, post form or photo viewer */}
      <div ref={containerRef} className="isolate h-full w-full" />

      {/* Menu button: top-left; slides beside the post form (sm+) or hides behind it on phones.
          left-99 = the form's 380px width + 16px gap */}
      <div className={`absolute top-4 z-20 transition-[left] duration-200 ${draft || commentsPost ? "left-4 max-sm:hidden sm:left-99" : "left-4"}`}>
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

      {commentsPost && (
        <CommentsPanel
          key={commentsPost.id}
          post={commentsPost}
          onClose={() => setCommentsPost(null)}
          onCountChange={updateCommentCount}
        />
      )}

      <ReportDialog
        post={reporting}
        onClose={closeReport}
        onReported={(p) => {
          // Hide it for this person straight away (the server does the same from now on)
          postsRef.current = postsRef.current.filter((x) => x.id !== p.id);
          (mapRef.current?.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(postsRef.current));
          syncCards();
          if (commentsPost?.id === p.id) setCommentsPost(null);
          setReporting(null);
          setToast("Thanks, the post was reported");
        }}
      />

      <Lightbox image={lightbox} onClose={closeLightbox} />
      <Toast message={toast} onDone={closeToast} />
    </>
  );
}
