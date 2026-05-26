export type ScreenShareQualityId = "low" | "balanced" | "high" | "max";

export interface ScreenShareQualityPreset {
  id: ScreenShareQualityId;
  label: string;
  hint: string;
  maxBitrate: number;
  maxFramerate: number;
  width: number;
  height: number;
}

export const SCREEN_SHARE_QUALITIES: ScreenShareQualityPreset[] = [
  {
    id: "low",
    label: "Low",
    hint: "720p · 1 Mbps",
    maxBitrate: 1_000_000,
    maxFramerate: 15,
    width: 1280,
    height: 720,
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "1080p · 2 Mbps",
    maxBitrate: 2_000_000,
    maxFramerate: 24,
    width: 1920,
    height: 1080,
  },
  {
    id: "high",
    label: "High",
    hint: "1080p · 4 Mbps",
    maxBitrate: 4_000_000,
    maxFramerate: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: "max",
    label: "Max",
    hint: "1080p · 8 Mbps",
    maxBitrate: 8_000_000,
    maxFramerate: 30,
    width: 1920,
    height: 1080,
  },
];

const STORAGE_KEY = "kumo-screen-share-quality";

export function getScreenShareQualityPreset(
  id: ScreenShareQualityId
): ScreenShareQualityPreset {
  return SCREEN_SHARE_QUALITIES.find((q) => q.id === id) ?? SCREEN_SHARE_QUALITIES[1];
}

export function loadScreenShareQuality(): ScreenShareQualityId {
  if (typeof window === "undefined") return "balanced";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SCREEN_SHARE_QUALITIES.some((q) => q.id === stored)) {
    return stored as ScreenShareQualityId;
  }
  return "balanced";
}

export function saveScreenShareQuality(id: ScreenShareQualityId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

export function buildShareVideoConstraints(
  preset: ScreenShareQualityPreset,
  surface?: "monitor" | "window" | "browser"
): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    width: { ideal: preset.width, max: preset.width },
    height: { ideal: preset.height, max: preset.height },
    frameRate: { ideal: preset.maxFramerate, max: preset.maxFramerate },
  };
  if (surface) {
    return { displaySurface: surface, ...base };
  }
  return base;
}

export async function applyScreenTrackConstraints(
  track: MediaStreamTrack,
  preset: ScreenShareQualityPreset
) {
  await track.applyConstraints({
    width: { ideal: preset.width, max: preset.width },
    height: { ideal: preset.height, max: preset.height },
    frameRate: { ideal: preset.maxFramerate, max: preset.maxFramerate },
  });
}
