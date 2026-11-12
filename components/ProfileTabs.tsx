"use client";

import { KeyboardEvent, useCallback, useRef, useState } from "react";
import MyPosts from "./MyPosts";
import SavedPosts from "./SavedPosts";
import MyComments from "./MyComments";

const TABS = [
  { id: "mine", label: "Your posts" },
  { id: "saved", label: "Saved" },
  { id: "comments", label: "Comments" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Toggle between your posts, saved posts and your comments. All lists stay mounted (just hidden),
// so counts load up front and switching is instant.
export default function ProfileTabs() {
  const [tab, setTab] = useState<TabId>("mine");
  const [counts, setCounts] = useState<Record<TabId, number | null>>({ mine: null, saved: null, comments: null });
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ mine: null, saved: null, comments: null });

  const setMineCount = useCallback((n: number) => setCounts((c) => ({ ...c, mine: n })), []);
  const setSavedCount = useCallback((n: number) => setCounts((c) => ({ ...c, saved: n })), []);
  const setCommentsCount = useCallback((n: number) => setCounts((c) => ({ ...c, comments: n })), []);

  // Left/Right arrows move between tabs (standard tablist keyboard behavior)
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Profile" onKeyDown={onKeyDown} className="flex gap-1 self-start">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-surface text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
              {counts[t.id] !== null && <span className={`text-xs tabular-nums ${active ? "text-accent" : ""}`}>{counts[t.id]}</span>}
            </button>
          );
        })}
      </div>

      <div id="panel-mine" role="tabpanel" aria-labelledby="tab-mine" hidden={tab !== "mine"}>
        <MyPosts onCount={setMineCount} />
      </div>
      <div id="panel-saved" role="tabpanel" aria-labelledby="tab-saved" hidden={tab !== "saved"}>
        <SavedPosts onCount={setSavedCount} />
      </div>
      <div id="panel-comments" role="tabpanel" aria-labelledby="tab-comments" hidden={tab !== "comments"}>
        <MyComments onCount={setCommentsCount} />
      </div>
    </div>
  );
}
