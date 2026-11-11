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
import PostCard, { PostActions } from "./PostCard";
import FeedPanel from "./FeedPanel";
import Select from "./Select";
import { ALL_CATEGORIES, FILTER_OPTIONS, filterSwatch, matchesFilter } from "@/lib/categories";
import Lightbox, { LightboxImage } from "./Lightbox";
import CommentsPanel from "./CommentsPanel";
import ReportDialog from "./ReportDialog";
import Toast from "./Toast";
import { boundsAround, distanceKm } from "@/lib/geo";

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
  // The post layers don't exist while the map first loads or while a light/dark style swap
  // is in progress, and querying a missing layer throws. Nothing to hit until they're back.
  if (!map.getLayer(DOT_LAYER) || !map.getLayer(CLUSTER_LAYER)) return null;
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

// The nearby feed: posts within this distance of the clicked one, closest first
const FEED_RADIUS_KM = 10;
const FEED_MAX = 50;

const PANEL_WIDTH = 380; // SidePanel on sm+ screens (w-95)
const isPhone = () => window.matchMedia("(max-width: 639px)").matches; // SidePanel is full screen

// The posts that pass the category filter: what the map's dots, groups and cards show
const shownPosts = (posts: Post[], filter: string) => posts.filter((p) => matchesFilter(p.category, filter));

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
  const postsRef = useRef<Post[]>([]); // every post loaded, whatever the category filter
  const filterRef = useRef(ALL_CATEGORIES);
  const loadIdRef = useRef(0); // ignores responses from older, slower requests
  const draftMarkerRef = useRef<Marker | null>(null);
  const cardsRef = useRef(new Map<string, CardEntry>());
  const highlightRef = useRef<string | null>(null); // post id from a share link, or picked in the feed
  const feedLoadRef = useRef(0);
  const feedOpenRef = useRef(false);

  // Side panels: the new-post form (draft) or the nearby feed, with a post's comments able to
  // open on top of the feed (closing them goes back to it)
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [feed, setFeed] = useState<{ origin: Post; posts: Post[] | null } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [reporting, setReporting] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState(ALL_CATEGORIES);
  const { theme, accent, ready } = useSettings();
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeToast = useCallback(() => setToast(null), []);
  const closeReport = useCallback(() => setReporting(null), []);
  const commentsPostId = commentsPost?.id;
  useEffect(() => {
    feedOpenRef.current = feed !== null;
  }, [feed]);

  // Change one post locally (e.g. a new comment count) and redraw its card and feed entry
  const patchPost = useCallback((id: string, patch: Partial<Post>) => {
    const apply = (p: Post) => (p.id === id ? { ...p, ...patch } : p);
    postsRef.current = postsRef.current.map(apply);
    setFeed((f) => f && { origin: apply(f.origin), posts: f.posts?.map(apply) ?? null });
    const card = cardsRef.current.get(id);
    if (card) {
      card.post = { ...card.post, ...patch };
      card.render();
    }
  }, []);

  // Optimistic save toggle: update right away, roll back if the server says no
  const toggleSave = useCallback(
    async (p: Post) => {
      const next = !p.saved;
      patchPost(p.id, { saved: next, save_count: p.save_count + (next ? 1 : -1) });
      const err = await setSaved(p.id, next);
      if (err) {
        console.error("Couldn't update save:", err);
        patchPost(p.id, { saved: p.saved, save_count: p.save_count });
      }
    },
    [patchPost]
  );

  // Ring one post (on its map card and in the feed), or none
  const setHighlight = useCallback((id: string | null) => {
    highlightRef.current = id;
    setFocusedId(id);
    for (const card of cardsRef.current.values()) card.render();
  }, []);

  // Move the map so a post's card is in view, beside the side panel rather than under it
  const showOnMap = useCallback((p: Post, always: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const besidePanel = !isPhone();
    const x = map.project([p.lng, p.lat]).x;
    if (!always && (!besidePanel || x > PANEL_WIDTH + 140)) return; // already clear of the panel
    map.easeTo({
      center: [p.lng, p.lat],
      zoom: Math.max(map.getZoom(), CARD_ZOOM),
      offset: besidePanel ? [PANEL_WIDTH / 2, 120] : [0, 120], // the card hangs above its dot
    });
  }, []);

  // Open the feed of posts near `origin`, closest first
  const openFeed = useCallback(
    async (origin: Post) => {
      setDraft(null);
      setCommentsPost(null);
      setFeed({ origin, posts: null });
      setHighlight(origin.id);
      showOnMap(origin, false);

      const loadId = ++feedLoadRef.current;
      const found = await fetchPostsInView(boundsAround(origin, FEED_RADIUS_KM));
      if (loadId !== feedLoadRef.current) return; // another post was clicked meanwhile
      const posts = found
        .map((p) => ({ p, d: distanceKm(origin, p) }))
        .filter(({ d }) => d <= FEED_RADIUS_KM)
        .sort((a, b) => a.d - b.d || Number(b.p.id === origin.id) - Number(a.p.id === origin.id))
        .slice(0, FEED_MAX)
        .map(({ p }) => p);
      setFeed((f) => f && f.origin.id === origin.id ? { ...f, posts } : f);
    },
    [setHighlight, showOnMap]
  );

  const closeFeed = useCallback(() => {
    feedLoadRef.current++;
    setFeed(null);
    setHighlight(null);
  }, [setHighlight]);

  // Picking a post in the feed: ring it and bring it into view. Phones close the
  // full-screen feed so the map can be seen.
  function focusPost(p: Post) {
    setHighlight(p.id);
    showOnMap(p, true);
    if (isPhone()) setFeed(null);
  }

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

  // The actions on a post, the same on map cards and in the feed. Kept in a ref so the
  // map cards (created once, outside React's render) always call the current versions.
  const actionsFor = (p: Post): PostActions => ({
    onExpand: (src, alt) => setLightbox({ src, alt }),
    onToggleSave: () => toggleSave(p),
    onOpenComments: () => {
      setDraft(null);
      setCommentsPost(p);
    },
    onShare: () => sharePost(p),
    onReport: () => setReporting(p),
  });
  const cardActionsRef = useRef({ actionsFor, openFeed, closeFeed });
  useEffect(() => {
    cardActionsRef.current = { actionsFor, openFeed, closeFeed };
  });

  // Every post in view shows as a card once zoomed in to CARD_ZOOM; otherwise none do
  const syncCards = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const open = map.getZoom() >= CARD_ZOOM ? shownPosts(postsRef.current, filterRef.current) : [];
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

      const entry: CardEntry = {
        marker: new Marker({ element: el, anchor: "bottom", offset: [0, -CARD_LIFT] }).setLngLat([p.lng, p.lat]),
        root,
        post: p,
        render: () =>
          root.render(
            <PostCard
              post={entry.post}
              highlighted={entry.post.id === highlightRef.current}
              onOpen={() => cardActionsRef.current.openFeed(entry.post)}
              {...cardActionsRef.current.actionsFor(entry.post)}
            />
          ),
      };
      entry.render();
      entry.marker.addTo(map);
      return entry;
    }
  }, []);

  // Redraw dots, groups and cards from the loaded posts and the current filter
  const showPosts = useCallback(() => {
    (mapRef.current?.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(shownPosts(postsRef.current, filterRef.current)));
    syncCards();
  }, [syncCards]);

  const loadPosts = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const loadId = ++loadIdRef.current;
    const posts = await fetchPostsInView(paddedBounds(map));
    if (loadId !== loadIdRef.current) return; // the map moved again while this was loading
    postsRef.current = posts;
    showPosts();
  }, [showPosts]);

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
      addPostLayers(map, shownPosts(postsRef.current, filterRef.current));
      syncCards();
    });

    map.on("load", loadPosts);
    // A share link's highlight goes once you start exploring (the feed's stays while it's open)
    map.on("dragstart", () => {
      if (highlightRef.current && !feedOpenRef.current) setHighlight(null);
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
      if (!map.getLayer(DOT_LAYER)) return; // layers not ready yet: don't drop pins on a half-loaded map

      const f = nearestPostFeature(map, e.point);
      if (!f) {
        setCommentsPost(null);
        cardActionsRef.current.closeFeed();
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
  }, [loadPosts, syncCards, setHighlight]);

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

      {/* Menu button and category filter: top-left; slides beside the post form (sm+) or hides behind it on phones.
          left-99 = the form's 380px width + 16px gap */}
      <div className={`absolute top-4 z-20 transition-[left] duration-200 ${draft || feed || commentsPost ? "left-4 max-sm:hidden sm:left-99" : "left-4"}`}>
        <div className="flex items-start gap-2">
          <NavMenu />
          <div className="w-44">
            <Select
              value={filter}
              options={FILTER_OPTIONS}
              onChange={(v) => {
                filterRef.current = v;
                setFilter(v);
                showPosts();
              }}
              swatch={filterSwatch}
              floating
              ariaLabel="Show category"
            />
          </div>
        </div>
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

      {feed && (
        <FeedPanel
          origin={feed.origin}
          posts={feed.posts && feed.posts.filter((p) => p.id === feed.origin.id || matchesFilter(p.category, filter))}
          radiusKm={FEED_RADIUS_KM}
          category={filter === ALL_CATEGORIES ? undefined : filter}
          focusedId={focusedId}
          onFocus={focusPost}
          onClose={closeFeed}
          actionsFor={actionsFor}
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
          showPosts();
          if (commentsPost?.id === p.id) setCommentsPost(null);
          if (feed?.origin.id === p.id) closeFeed();
          else setFeed((f) => f && { ...f, posts: f.posts?.filter((x) => x.id !== p.id) ?? null });
          setReporting(null);
          setToast("Thanks, the post was reported");
        }}
      />

      <Lightbox image={lightbox} onClose={closeLightbox} />
      <Toast message={toast} onDone={closeToast} />
    </>
  );
}
