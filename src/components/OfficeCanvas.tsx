"use client";

import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AUDIO_RANGE,
  ChatMessage,
  DEFAULT_OFFICE,
  OfficeMap,
  RoomZone,
  SCREEN_SHARE_RANGE,
  User,
  distance,
  getScreenSharePresence,
  getZoneAt,
} from "@/lib/types";
import { Avatar } from "@/components/Avatar";

const BUBBLE_TTL_MS = 8000;

interface OfficeCanvasProps {
  users: User[];
  localUser: User;
  onMove: (x: number, y: number) => void;
  messages?: ChatMessage[];
  map?: OfficeMap;
}

const ZONE_STYLES: Record<
  RoomZone["type"],
  { bg: string; label: string }
> = {
  open: {
    bg: "var(--room)",
    label: "text-[var(--ink-2)]",
  },
  meeting: {
    bg: "var(--room-warm)",
    label: "text-[var(--ink-2)]",
  },
  focus: {
    bg: "var(--room-warm)",
    label: "text-[var(--ink-2)]",
  },
  lounge: {
    bg: "var(--room)",
    label: "text-[var(--ink-2)]",
  },
};

export function OfficeCanvas({
  users,
  localUser,
  onMove,
  messages = [],
  map = DEFAULT_OFFICE,
}: OfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  // Ephemeral speech bubbles: the latest message per author within the TTL,
  // rendered over that author's avatar (6-B). Tick every second so they expire.
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const bubbles = useMemo(() => {
    const latest = new Map<string, ChatMessage>();
    for (const message of messages) {
      if (now - message.timestamp > BUBBLE_TTL_MS) continue;
      if (!userById.has(message.userId)) continue;
      latest.set(message.userId, message);
    }
    return Array.from(latest.values());
  }, [messages, now, userById]);

  useEffect(() => {
    if (bubbles.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [bubbles.length]);

  useEffect(() => {
    if (messages.length === 0) return;
    setNow(Date.now());
  }, [messages]);

  useLayoutEffect(() => {
    const updateScale = () => {
      const el = containerRef.current;
      if (!el) return;
      const padding = 24;
      const w = el.clientWidth - padding * 2;
      const h = el.clientHeight - padding * 2;
      if (w <= 0 || h <= 0) return;
      const next = Math.min(w / map.width, h / map.height);
      setScale(next);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [map.width, map.height]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = worldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    onMove(x, y);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-[var(--floor)] p-6 shadow-[var(--shadow-md)]"
    >
      {/* Floor pattern */}
      <div className="pointer-events-none absolute inset-0 floor-pattern" />

      <div
        ref={worldRef}
        className="relative cursor-crosshair select-none"
        style={{
          width: map.width,
          height: map.height,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
        onClick={handleCanvasClick}
      >
        {/* Zones */}
        {map.zones.map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}

        <div
          className="pointer-events-none absolute rounded-full transition-[left,top,width,height] duration-500 ease-out"
          style={{
            left: localUser.x - SCREEN_SHARE_RANGE,
            top: localUser.y - SCREEN_SHARE_RANGE,
            width: SCREEN_SHARE_RANGE * 2,
            height: SCREEN_SHARE_RANGE * 2,
            background:
              "radial-gradient(circle, rgba(226,90,60,0.05) 0%, rgba(226,90,60,0.015) 55%, transparent 100%)",
            border: "1px dashed rgba(226,90,60,0.14)",
          }}
        />

        <div
          className="pointer-events-none absolute rounded-full transition-[left,top] duration-150 ease-out"
          style={{
            left: localUser.x - AUDIO_RANGE,
            top: localUser.y - AUDIO_RANGE,
            width: AUDIO_RANGE * 2,
            height: AUDIO_RANGE * 2,
            background:
              "radial-gradient(circle, rgba(226,90,60,0.10) 0%, rgba(226,90,60,0.04) 60%, transparent 100%)",
            border: "1.5px dashed var(--accent)",
          }}
        />

        {/* Avatars */}
        {users.map((user) => {
          const isLocal = user.id === localUser.id;
          const zone = isLocal ? getZoneAt(user.x, user.y, map) : null;
          const isNearby = !isLocal && distance(user, localUser) <= AUDIO_RANGE;
          const isSpeaking = user.micEnabled && (isLocal || isNearby);
          const sharePresence = isLocal
            ? 1
            : getScreenSharePresence(distance(user, localUser));
          const isPresenting =
            user.screenSharing && (isLocal || sharePresence > 0.06);

          return (
            <div
              key={user.id}
              className={clsx(
                "absolute -translate-x-1/2 -translate-y-1/2",
                isLocal ? "z-30" : "z-20",
                "transition-[left,top,opacity] duration-500 ease-out"
              )}
              style={{
                left: user.x,
                top: user.y,
                opacity: user.screenSharing && !isLocal ? 0.35 + sharePresence * 0.65 : 1,
              }}
            >
              <Avatar
                user={user}
                isLocal={isLocal}
                isSpeaking={isSpeaking}
                isPresenting={isPresenting}
                zoneName={zone?.name}
                size="md"
              />
            </div>
          );
        })}

        {/* Ephemeral speech bubbles over avatars (6-B) */}
        {bubbles.map((message) => {
          const author = userById.get(message.userId);
          if (!author) return null;
          const mine = message.userId === localUser.id;
          return (
            <div
              key={message.id}
              className={clsx(
                "vs-bubble animate-float-in absolute z-40",
                mine && "mine"
              )}
              style={{ left: author.x, top: author.y - 34 }}
            >
              {message.text}
            </div>
          );
        })}
      </div>

      {/* Floor info pill */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--ink-soft)] shadow-[var(--shadow-sm)]">
        <span className="vs-kbd">W</span>
        <span className="vs-kbd">A</span>
        <span className="vs-kbd">S</span>
        <span className="vs-kbd">D</span>
        <span className="ml-1">or click to walk · inner ring = voice · outer = screen fades</span>
      </div>
    </div>
  );
}

function ZoneCard({ zone }: { zone: RoomZone }) {
  const style = ZONE_STYLES[zone.type];

  return (
    <div
      className="absolute overflow-hidden rounded-[4px] border-[1.5px] border-[var(--wall-2)]"
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        background: style.bg,
      }}
    >
      {/* Zone name label */}
      <div
        className={clsx(
          "absolute left-3.5 top-2.5 z-10 text-[11px] font-semibold uppercase tracking-[0.06em]",
          style.label
        )}
      >
        {zone.name}
      </div>

      {/* Furniture decoration */}
      <ZoneFurniture zone={zone} />
    </div>
  );
}

function ZoneFurniture({ zone }: { zone: RoomZone }) {
  const cx = zone.width / 2;
  const cy = zone.height / 2;

  if (zone.type === "meeting") {
    return (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${zone.width} ${zone.height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Long table */}
        <rect
          x={cx - 70}
          y={cy - 22}
          width={140}
          height={44}
          rx={10}
          fill="rgba(181, 158, 112, 0.18)"
          stroke="rgba(181, 158, 112, 0.35)"
          strokeWidth="1.5"
        />
        {/* Chairs around */}
        {[-50, -25, 0, 25, 50].map((offset) => (
          <g key={`top-${offset}`}>
            <rect
              x={cx + offset - 9}
              y={cy - 44}
              width={18}
              height={14}
              rx={4}
              fill="rgba(181, 158, 112, 0.22)"
            />
            <rect
              x={cx + offset - 9}
              y={cy + 30}
              width={18}
              height={14}
              rx={4}
              fill="rgba(181, 158, 112, 0.22)"
            />
          </g>
        ))}
      </svg>
    );
  }

  if (zone.type === "focus") {
    return (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${zone.width} ${zone.height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Single desk */}
        <rect
          x={cx - 30}
          y={cy - 8}
          width={60}
          height={28}
          rx={6}
          fill="rgba(108, 143, 90, 0.18)"
          stroke="rgba(108, 143, 90, 0.32)"
          strokeWidth="1.5"
        />
        {/* Monitor */}
        <rect
          x={cx - 16}
          y={cy - 22}
          width={32}
          height={14}
          rx={3}
          fill="rgba(108, 143, 90, 0.32)"
        />
        {/* Chair */}
        <rect
          x={cx - 12}
          y={cy + 26}
          width={24}
          height={14}
          rx={4}
          fill="rgba(108, 143, 90, 0.22)"
        />
      </svg>
    );
  }

  if (zone.type === "lounge") {
    return (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${zone.width} ${zone.height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Couch */}
        <rect
          x={cx - 80}
          y={cy - 18}
          width={160}
          height={48}
          rx={14}
          fill="rgba(139, 85, 119, 0.16)"
          stroke="rgba(139, 85, 119, 0.30)"
          strokeWidth="1.5"
        />
        {/* Cushions */}
        <rect
          x={cx - 70}
          y={cy - 12}
          width={50}
          height={20}
          rx={6}
          fill="rgba(139, 85, 119, 0.25)"
        />
        <rect
          x={cx - 10}
          y={cy - 12}
          width={50}
          height={20}
          rx={6}
          fill="rgba(139, 85, 119, 0.25)"
        />
        {/* Plant left */}
        <circle cx={26} cy={zone.height - 30} r={10} fill="rgba(108, 143, 90, 0.25)" />
        <rect x={22} y={zone.height - 22} width={8} height={14} rx={2} fill="rgba(164, 104, 58, 0.35)" />
        {/* Plant right */}
        <circle cx={zone.width - 26} cy={30} r={10} fill="rgba(108, 143, 90, 0.25)" />
        <rect
          x={zone.width - 30}
          y={38}
          width={8}
          height={14}
          rx={2}
          fill="rgba(164, 104, 58, 0.35)"
        />
      </svg>
    );
  }

  // Open desk / standup / reception / kitchen-like open
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${zone.width} ${zone.height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Multiple desks in a grid */}
      {Array.from({ length: Math.max(1, Math.floor(zone.width / 160)) }).map((_, col) =>
        Array.from({ length: Math.max(1, Math.floor(zone.height / 160)) }).map((_, row) => {
          const x = 60 + col * 160;
          const y = 60 + row * 160;
          if (x > zone.width - 40 || y > zone.height - 40) return null;
          return (
            <g key={`${col}-${row}`}>
              <rect
                x={x - 28}
                y={y - 10}
                width={56}
                height={22}
                rx={5}
                fill="rgba(181, 158, 112, 0.15)"
                stroke="rgba(181, 158, 112, 0.28)"
                strokeWidth="1.2"
              />
              <rect
                x={x - 14}
                y={y - 20}
                width={28}
                height={10}
                rx={2}
                fill="rgba(181, 158, 112, 0.28)"
              />
            </g>
          );
        })
      )}
    </svg>
  );
}
