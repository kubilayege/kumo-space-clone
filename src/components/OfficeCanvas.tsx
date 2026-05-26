"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, useState } from "react";
import {
  AUDIO_RANGE,
  DEFAULT_OFFICE,
  RoomZone,
  SCREEN_SHARE_RANGE,
  User,
  distance,
  getScreenSharePresence,
  getZoneAt,
} from "@/lib/types";
import { Avatar } from "@/components/Avatar";

interface OfficeCanvasProps {
  users: User[];
  localUser: User;
  onMove: (x: number, y: number) => void;
}

const ZONE_STYLES: Record<
  RoomZone["type"],
  { bg: string; border: string; accent: string; label: string }
> = {
  open: {
    bg: "from-indigo-500/[0.07] to-indigo-500/[0.02]",
    border: "border-indigo-300/15",
    accent: "text-indigo-200",
    label: "bg-indigo-500/15 text-indigo-100 border-indigo-300/20",
  },
  meeting: {
    bg: "from-amber-500/[0.08] to-amber-500/[0.02]",
    border: "border-amber-300/20",
    accent: "text-amber-200",
    label: "bg-amber-500/15 text-amber-100 border-amber-300/25",
  },
  focus: {
    bg: "from-emerald-500/[0.07] to-emerald-500/[0.02]",
    border: "border-emerald-300/15",
    accent: "text-emerald-200",
    label: "bg-emerald-500/15 text-emerald-100 border-emerald-300/20",
  },
  lounge: {
    bg: "from-fuchsia-500/[0.06] to-fuchsia-500/[0.02]",
    border: "border-fuchsia-300/15",
    accent: "text-fuchsia-200",
    label: "bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-300/20",
  },
};

export function OfficeCanvas({ users, localUser, onMove }: OfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const map = DEFAULT_OFFICE;

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
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0a0a14] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {/* Floor pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-60 floor-pattern" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-indigo-600/[0.05] blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-fuchsia-600/[0.04] blur-3xl" />

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
        {/* Floor base */}
        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-[#0f0f1e] via-[#0c0c18] to-[#0a0a14] shadow-[inset_0_0_120px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.04]" />

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
              "radial-gradient(circle, rgba(139,92,246,0.06) 0%, rgba(139,92,246,0.02) 55%, transparent 100%)",
            border: "1px dashed rgba(139,92,246,0.12)",
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
              "radial-gradient(circle, rgba(129,140,248,0.10) 0%, rgba(129,140,248,0.04) 60%, transparent 100%)",
            border: "1px dashed rgba(129,140,248,0.25)",
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
      </div>

      {/* Floor info pill */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/[0.06] bg-black/40 px-3 py-1.5 text-[11px] text-zinc-400 backdrop-blur">
        <span className="font-medium text-zinc-300">WASD</span> to move ·{" "}
        <span className="font-medium text-zinc-300">click</span> to walk · inner ring = voice · outer = screen fades out
      </div>
    </div>
  );
}

function ZoneCard({ zone }: { zone: RoomZone }) {
  const style = ZONE_STYLES[zone.type];

  return (
    <div
      className={clsx(
        "absolute overflow-hidden rounded-3xl border bg-gradient-to-br shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        style.bg,
        style.border
      )}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
      }}
    >
      {/* Zone name label */}
      <div
        className={clsx(
          "absolute left-4 top-3 z-10 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-sm",
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
          fill="rgba(251, 191, 36, 0.18)"
          stroke="rgba(251, 191, 36, 0.35)"
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
              fill="rgba(251, 191, 36, 0.22)"
            />
            <rect
              x={cx + offset - 9}
              y={cy + 30}
              width={18}
              height={14}
              rx={4}
              fill="rgba(251, 191, 36, 0.22)"
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
          fill="rgba(74, 222, 128, 0.18)"
          stroke="rgba(74, 222, 128, 0.32)"
          strokeWidth="1.5"
        />
        {/* Monitor */}
        <rect
          x={cx - 16}
          y={cy - 22}
          width={32}
          height={14}
          rx={3}
          fill="rgba(74, 222, 128, 0.32)"
        />
        {/* Chair */}
        <rect
          x={cx - 12}
          y={cy + 26}
          width={24}
          height={14}
          rx={4}
          fill="rgba(74, 222, 128, 0.22)"
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
          fill="rgba(232, 121, 249, 0.16)"
          stroke="rgba(232, 121, 249, 0.30)"
          strokeWidth="1.5"
        />
        {/* Cushions */}
        <rect
          x={cx - 70}
          y={cy - 12}
          width={50}
          height={20}
          rx={6}
          fill="rgba(232, 121, 249, 0.25)"
        />
        <rect
          x={cx - 10}
          y={cy - 12}
          width={50}
          height={20}
          rx={6}
          fill="rgba(232, 121, 249, 0.25)"
        />
        {/* Plant left */}
        <circle cx={26} cy={zone.height - 30} r={10} fill="rgba(34, 197, 94, 0.25)" />
        <rect x={22} y={zone.height - 22} width={8} height={14} rx={2} fill="rgba(120, 53, 15, 0.35)" />
        {/* Plant right */}
        <circle cx={zone.width - 26} cy={30} r={10} fill="rgba(34, 197, 94, 0.25)" />
        <rect
          x={zone.width - 30}
          y={38}
          width={8}
          height={14}
          rx={2}
          fill="rgba(120, 53, 15, 0.35)"
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
                fill="rgba(129, 140, 248, 0.15)"
                stroke="rgba(129, 140, 248, 0.28)"
                strokeWidth="1.2"
              />
              <rect
                x={x - 14}
                y={y - 20}
                width={28}
                height={10}
                rx={2}
                fill="rgba(129, 140, 248, 0.28)"
              />
            </g>
          );
        })
      )}
    </svg>
  );
}
