"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Camera, Mic, MicOff, VideoOff, Volume2 } from "lucide-react";
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
    element.volume = tile.isLocal ? 0 : tile.volume;
    if (tile.stream) {
      void element.play().catch(() => {});
    }
  }, [tile.stream, tile.volume, tile.isLocal]);

  const hasVideo =
    !!tile.stream &&
    tile.stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

  const speaking = tile.user.micEnabled && (tile.isLocal || tile.volume > 0.01);

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-2xl border bg-zinc-900/60 transition",
        speaking
          ? "border-emerald-400/40 shadow-[0_0_24px_-8px_rgba(34,197,94,0.6)]"
          : "border-white/[0.08]"
      )}
    >
      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted={tile.isLocal}
        className={clsx("aspect-video w-full object-cover", !hasVideo && "opacity-0")}
      />

      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${tile.user.color}cc, ${tile.user.color}66)`,
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative flex flex-col items-center gap-1.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/40 shadow-lg"
              style={{ backgroundColor: tile.user.color }}
            >
              {getInitials(tile.user.name)}
            </div>
            {!tile.user.cameraEnabled && (
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur">
                <VideoOff className="h-2.5 w-2.5" /> camera off
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top-right indicators */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {!tile.isLocal && tile.connectionState && tile.connectionState !== "connected" && (
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur",
              tile.connectionState === "connecting" && "bg-amber-500/30 text-amber-100",
              tile.connectionState === "new" && "bg-zinc-700/60 text-zinc-200",
              tile.connectionState === "failed" && "bg-rose-500/40 text-rose-50"
            )}
          >
            {tile.connectionState === "connecting" && "connecting"}
            {tile.connectionState === "new" && "starting"}
            {tile.connectionState === "failed" && "failed"}
          </span>
        )}
        {!tile.user.micEnabled && (
          <span className="rounded-full bg-black/60 p-1 backdrop-blur">
            <MicOff className="h-3 w-3 text-rose-300" />
          </span>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 py-1.5">
        <span className="truncate text-[12px] font-medium text-white">
          {tile.user.name}
          {tile.isLocal && <span className="ml-1 text-indigo-300">· you</span>}
        </span>
        <div className="flex items-center gap-1.5 text-white/80">
          {tile.user.micEnabled && <AudioBars active={speaking} />}
          {!tile.isLocal && expanded && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-300">
              <Volume2 className="h-2.5 w-2.5" />
              {Math.round(tile.volume * 100)}
            </span>
          )}
        </div>
      </div>

      {/* Volume bar (top thin line, remote only) */}
      {!tile.isLocal && tile.user.micEnabled && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-white/5">
          <div
            className="h-full bg-emerald-400/70 transition-all duration-300"
            style={{ width: `${tile.volume * 100}%` }}
          />
        </div>
      )}
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
    ...nearbyUsers.map(({ user, volume }) => ({
      id: user.id,
      user,
      stream: remoteStreams.get(user.id) ?? null,
      isLocal: false,
      volume,
      connectionState: peerStates.get(user.id),
    })),
  ];

  const hasNearby = tiles.length > 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-zinc-400" />
          <h3 className="text-[13px] font-semibold tracking-tight text-white">Nearby</h3>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {hasNearby ? tiles.length - 1 : 0}
          </span>
        </div>
        {hasNearby && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-zinc-500 transition hover:text-white"
          >
            {expanded ? "hide details" : "show details"}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {tiles.map((tile) => (
          <VideoTile key={tile.id} tile={tile} expanded={expanded} />
        ))}

        {!hasNearby && (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center">
            <Mic className="mx-auto h-5 w-5 text-zinc-500" />
            <p className="mt-2 text-[12px] font-medium text-zinc-300">It&apos;s quiet here</p>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              Walk near a teammate to start a conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
