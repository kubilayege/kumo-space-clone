"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Loader2,
  MicOff,
  Radio,
  VideoOff,
  Volume2,
  Wifi,
} from "lucide-react";
import { User, distance, getAudioVolume, getInitials } from "@/lib/types";
import { ConnectionState } from "@/lib/webrtc";

interface VideoGridProps {
  localUser: User;
  users: User[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  peerStates: Map<string, ConnectionState>;
}

interface TileData {
  id: string;
  user: User;
  stream: MediaStream | null;
  isLocal: boolean;
  volume: number;
  connectionState?: ConnectionState;
  dist?: number;
}

function AudioBars({ active }: { active: boolean }) {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className={clsx(
            "block w-[3px] rounded-full bg-emerald-400",
            active ? "audio-bar" : "opacity-40"
          )}
          style={{
            height: 10 + i * 3,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </span>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;

  const config = {
    connecting: {
      className: "border-amber-400/30 bg-amber-500/20 text-amber-100",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
      label: "connecting",
    },
    new: {
      className: "border-zinc-500/30 bg-zinc-800/80 text-zinc-300",
      icon: <Wifi className="h-2.5 w-2.5" />,
      label: "starting",
    },
    failed: {
      className: "border-rose-400/30 bg-rose-500/25 text-rose-100",
      icon: <AlertCircle className="h-2.5 w-2.5" />,
      label: "failed",
    },
  }[state];

  if (!config) return null;

  return (
    <span
      className={clsx(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function AvatarStack({ users: stackUsers }: { users: User[] }) {
  const visible = stackUsers.slice(0, 4);
  const overflow = stackUsers.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <div
            key={user.id}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-zinc-950"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {getInitials(user.name)}
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1.5 text-[10px] font-medium text-zinc-500">+{overflow}</span>
      )}
    </div>
  );
}

function VideoTile({
  tile,
  expanded,
}: {
  tile: TileData;
  expanded: boolean;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.srcObject = tile.stream;
    element.volume = 0;
    if (tile.stream) {
      void element.play().catch(() => {});
    }
  }, [tile.stream]);

  const hasVideo =
    !!tile.stream &&
    tile.stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

  const speaking = tile.user.micEnabled && (tile.isLocal || tile.volume > 0.01);
  const distanceMeters = tile.dist !== undefined ? Math.max(1, Math.round(tile.dist / 50)) : null;

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-2xl border bg-zinc-950/80 transition-all duration-300",
        "hover:border-white/[0.18] hover:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)]",
        speaking
          ? "border-emerald-400/50 shadow-[0_0_32px_-6px_rgba(34,197,94,0.55)] ring-2 ring-emerald-400/40 speak-pulse"
          : "border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/10 to-black/30 opacity-90 transition-opacity duration-300 group-hover:opacity-75" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.45)_100%)]" />

      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted
        className={clsx(
          "aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
          !hasVideo && "opacity-0"
        )}
      />

      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(145deg, ${tile.user.color}dd 0%, ${tile.user.color}88 45%, #09090b 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative flex flex-col items-center gap-2">
            <div
              className={clsx(
                "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white shadow-xl ring-2 transition-transform duration-300 group-hover:scale-105",
                speaking ? "ring-emerald-400/60" : "ring-white/30"
              )}
              style={{ backgroundColor: tile.user.color }}
            >
              {getInitials(tile.user.name)}
            </div>
            {!tile.user.cameraEnabled && (
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
                <VideoOff className="h-2.5 w-2.5" /> camera off
              </span>
            )}
          </div>
        </div>
      )}

      <div className="absolute left-2 top-2 z-[2] flex items-center gap-1">
        {!tile.isLocal && distanceMeters !== null && (
          <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-200 backdrop-blur-md">
            {distanceMeters}m
          </span>
        )}
      </div>

      <div className="absolute right-2 top-2 z-[2] flex items-center gap-1">
        {!tile.isLocal && tile.connectionState && (
          <ConnectionBadge state={tile.connectionState} />
        )}
        {!tile.user.micEnabled && (
          <span className="rounded-full border border-rose-400/20 bg-black/60 p-1 backdrop-blur-md">
            <MicOff className="h-3 w-3 text-rose-300" />
          </span>
        )}
      </div>

      {speaking && (
        <div className="pointer-events-none absolute inset-0 z-[2] rounded-2xl ring-1 ring-inset ring-emerald-400/30" />
      )}

      <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center justify-between gap-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2.5 pb-2 pt-6">
        <span className="truncate text-[12px] font-medium text-white drop-shadow-sm">
          {tile.user.name}
          {tile.isLocal && <span className="ml-1 text-indigo-300/90">· you</span>}
        </span>
        <div className="flex shrink-0 items-center gap-1.5 text-white/80">
          {tile.user.micEnabled && (
            <span
              className={clsx(
                "flex items-center rounded-full px-1 py-0.5",
                speaking && "bg-emerald-500/20 ring-1 ring-emerald-400/30"
              )}
            >
              <AudioBars active={speaking} />
            </span>
          )}
          {!tile.isLocal && expanded && (
            <span className="flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-300 backdrop-blur-sm">
              <Volume2 className="h-2.5 w-2.5" />
              {Math.round(tile.volume * 100)}
            </span>
          )}
        </div>
      </div>

      {!tile.isLocal && tile.user.micEnabled && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-0.5 bg-white/5">
          <div
            className={clsx(
              "h-full transition-all duration-300",
              speaking ? "bg-emerald-400" : "bg-emerald-400/50"
            )}
            style={{ width: `${tile.volume * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.06),transparent_70%)]" />
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-emerald-500/15 animate-ping" />
        <span
          className="absolute inset-3 rounded-full border border-emerald-500/25 animate-ping"
          style={{ animationDuration: "2s" }}
        />
        <span
          className="absolute inset-6 rounded-full border border-emerald-500/35 animate-ping"
          style={{ animationDuration: "2.8s" }}
        />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 ring-1 ring-emerald-500/30">
          <Radio className="h-4 w-4 text-emerald-400/80" />
        </span>
      </div>
      <p className="relative mt-4 text-[12px] font-medium text-zinc-200">It&apos;s quiet here</p>
      <p className="relative mt-1.5 text-[11px] leading-5 text-zinc-500">
        Walk near a teammate to start a conversation.
      </p>
      <p className="relative mt-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
        move closer · audio fades in
      </p>
    </div>
  );
}

export function VideoGrid({
  localUser,
  users,
  localStream,
  remoteStreams,
  peerStates,
}: VideoGridProps) {
  const [expanded, setExpanded] = useState(false);

  const nearbyUsers = users
    .filter((user) => user.id !== localUser.id)
    .map((user) => ({
      user,
      dist: distance(localUser, user),
      volume: getAudioVolume(distance(localUser, user)),
    }))
    .filter(({ dist }) => dist <= 180)
    .sort((a, b) => a.dist - b.dist);

  const tiles: TileData[] = [
    {
      id: localUser.id,
      user: localUser,
      stream: localStream,
      isLocal: true,
      volume: 1,
    },
    ...nearbyUsers.map(({ user, dist, volume }) => ({
      id: user.id,
      user,
      stream: remoteStreams.get(user.id) ?? null,
      isLocal: false,
      volume,
      dist,
      connectionState: peerStates.get(user.id),
    })),
  ];

  const hasNearby = tiles.length > 1;
  const useGrid = tiles.length >= 3;
  const nearbySpeaking = nearbyUsers.some(
    ({ user, volume }) => user.micEnabled && volume > 0.01
  );
  const localSpeaking = localUser.micEnabled;
  const anyoneSpeaking = nearbySpeaking || (hasNearby && localSpeaking);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {anyoneSpeaking && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            </span>
          )}
          <Camera className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-white">Nearby</h3>
          <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
            {hasNearby ? tiles.length - 1 : 0}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!expanded && hasNearby && (
            <AvatarStack users={nearbyUsers.map(({ user }) => user)} />
          )}
          {hasNearby && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              {expanded ? "hide details" : "show details"}
            </button>
          )}
        </div>
      </div>

      <div
        className={clsx(
          "flex-1 overflow-y-auto px-4 pb-4",
          useGrid ? "grid grid-cols-2 gap-2" : "space-y-2"
        )}
      >
        {tiles.map((tile) => (
          <VideoTile key={tile.id} tile={tile} expanded={expanded} />
        ))}

        {!hasNearby && <EmptyState />}
      </div>
    </div>
  );
}
