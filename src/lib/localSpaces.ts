"use client";

import { OfficeMap } from "./types";

const RECENT_KEY = "atrium-recent-spaces";
const MAP_PREFIX = "atrium-space-map:";

export interface RecentSpace {
  id: string;
  lastSeen: number;
}

export function loadRecentSpaces(): RecentSpace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as RecentSpace[])
      .filter((s) => s && typeof s.id === "string")
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function rememberSpace(id: string) {
  if (typeof window === "undefined" || !id) return;
  const existing = loadRecentSpaces().filter((s) => s.id !== id);
  const next = [{ id, lastSeen: Date.now() }, ...existing].slice(0, 12);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage full / unavailable — non-fatal
  }
}

// Per-space copy of the last map this client saw or published. Lets the editor's
// changes survive even if the socket server (in-memory) forgets them, by
// re-seeding the server on the next join.
export function loadCachedMap(spaceId: string): OfficeMap | null {
  if (typeof window === "undefined" || !spaceId) return null;
  try {
    const raw = localStorage.getItem(MAP_PREFIX + spaceId);
    if (!raw) return null;
    const map = JSON.parse(raw) as OfficeMap;
    if (!map || !Array.isArray(map.zones)) return null;
    return map;
  } catch {
    return null;
  }
}

export function saveCachedMap(spaceId: string, map: OfficeMap) {
  if (typeof window === "undefined" || !spaceId) return;
  try {
    localStorage.setItem(MAP_PREFIX + spaceId, JSON.stringify(map));
  } catch {
    // ignore
  }
}
