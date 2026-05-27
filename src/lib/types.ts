export type UserStatus = "available" | "busy" | "away";

export interface User {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  status: UserStatus;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  screenAudioEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  scope: "nearby" | "floor" | "all";
  timestamp: number;
  zoneId?: string;
}

export type ChatScope = "nearby" | "floor" | "all";

export interface TypingEvent {
  userId: string;
  userName: string;
  userColor: string;
  scope: ChatScope;
  zoneId?: string;
}

export interface TypingStopEvent {
  userId: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
  userColor: string;
  scope: ChatScope;
  expiresAt: number;
}

export interface RoomZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "open" | "meeting" | "focus" | "lounge";
  color: string;
}

export interface OfficeMap {
  width: number;
  height: number;
  zones: RoomZone[];
}

export const AVATAR_COLORS = [
  "#e25a3c", // coral
  "#3f8e8a", // teal
  "#c99136", // gold
  "#8b5577", // plum
  "#6c8f5a", // sage
  "#4a7aae", // sky
  "#c94a2e", // deep coral
  "#5a7d6e", // pine
  "#a4683a", // clay
  "#7a6aa0", // iris
];

export const AUDIO_RANGE = 180;
export const SCREEN_SHARE_RANGE = 300;
export const SCREEN_SHARE_VISIBLE_THRESHOLD = 0.06;
export const NEARBY_CHAT_RANGE = 220;
export const MOVE_SPEED = 4;

export const DEFAULT_OFFICE: OfficeMap = {
  width: 1200,
  height: 800,
  zones: [
    {
      id: "open-desk",
      name: "Open Workspace",
      x: 40,
      y: 40,
      width: 520,
      height: 360,
      type: "open",
      color: "#eef2ff",
    },
    {
      id: "meeting-a",
      name: "Conference Room A",
      x: 600,
      y: 40,
      width: 280,
      height: 200,
      type: "meeting",
      color: "#fef3c7",
    },
    {
      id: "meeting-b",
      name: "Conference Room B",
      x: 920,
      y: 40,
      width: 240,
      height: 200,
      type: "meeting",
      color: "#fef3c7",
    },
    {
      id: "focus-1",
      name: "Focus Pod 1",
      x: 600,
      y: 280,
      width: 130,
      height: 120,
      type: "focus",
      color: "#dcfce7",
    },
    {
      id: "focus-2",
      name: "Focus Pod 2",
      x: 750,
      y: 280,
      width: 130,
      height: 120,
      type: "focus",
      color: "#dcfce7",
    },
    {
      id: "focus-3",
      name: "Focus Pod 3",
      x: 900,
      y: 280,
      width: 130,
      height: 120,
      type: "focus",
      color: "#dcfce7",
    },
    {
      id: "lounge",
      name: "Lounge",
      x: 40,
      y: 440,
      width: 520,
      height: 320,
      type: "lounge",
      color: "#fce7f3",
    },
    {
      id: "kitchen",
      name: "Kitchen",
      x: 600,
      y: 440,
      width: 280,
      height: 160,
      type: "lounge",
      color: "#ffedd5",
    },
    {
      id: "standup",
      name: "Standup Area",
      x: 920,
      y: 280,
      width: 240,
      height: 320,
      type: "open",
      color: "#e0f2fe",
    },
    {
      id: "reception",
      name: "Reception",
      x: 920,
      y: 640,
      width: 240,
      height: 120,
      type: "open",
      color: "#f3e8ff",
    },
  ],
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isNearby(
  a: { x: number; y: number },
  b: { x: number; y: number },
  range: number = AUDIO_RANGE
): boolean {
  return distance(a, b) <= range;
}

export function isWithinScreenShareRange(
  a: { x: number; y: number },
  b: { x: number; y: number },
  range: number = SCREEN_SHARE_RANGE
): boolean {
  return distance(a, b) <= range;
}

export function getScreenSharePresence(
  distancePx: number,
  range: number = SCREEN_SHARE_RANGE
): number {
  if (distancePx >= range) return 0;
  const t = 1 - distancePx / range;
  return Math.pow(t, 1.15);
}

export function shouldConnectPeer(localUser: User, peer: User): boolean {
  if (peer.id === localUser.id) return false;
  if (isNearby(localUser, peer)) return true;
  return peer.screenSharing && isWithinScreenShareRange(localUser, peer);
}

export function hasNearbyPresenter(
  localUser: User,
  users: User[],
  localScreenSharing: boolean
): boolean {
  if (localScreenSharing) return true;
  return users.some((user) => {
    if (!user.screenSharing || user.id === localUser.id) return false;
    return (
      getScreenSharePresence(distance(localUser, user)) >
      SCREEN_SHARE_VISIBLE_THRESHOLD
    );
  });
}

export function clampPosition(x: number, y: number, map: OfficeMap): { x: number; y: number } {
  return {
    x: Math.max(24, Math.min(map.width - 24, x)),
    y: Math.max(24, Math.min(map.height - 24, y)),
  };
}

export function getZoneAt(x: number, y: number, map: OfficeMap): RoomZone | null {
  for (const zone of map.zones) {
    if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
      return zone;
    }
  }
  return null;
}

export function getAudioVolume(distancePx: number, range: number = AUDIO_RANGE): number {
  if (distancePx >= range) return 0;
  const t = 1 - distancePx / range;
  return Math.pow(t, 1.5);
}
