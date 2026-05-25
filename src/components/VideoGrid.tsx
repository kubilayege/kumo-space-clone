"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { User, distance, getAudioVolume, getInitials } from "@/lib/types";

interface VideoGridProps {
  localUser: User;
  users: User[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

function VideoTile({
  name,
  color,
  stream,
  muted,
  volume,
  isLocal,
}: {
  name: string;
  color: string;
  stream: MediaStream | null;
  muted?: boolean;
  volume?: number;
  isLocal?: boolean;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    element.srcObject = stream;
    element.volume = isLocal ? 0 : (volume ?? 1);

    if (stream) {
      void element.play().catch(() => {});
    }
  }, [stream, volume, isLocal]);

  const hasVideo =
    !!stream &&
    stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

  const hasAudio =
    !!stream &&
    stream.getAudioTracks().some((track) => track.readyState === "live" && track.enabled);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted={muted}
        className={clsx(
          "aspect-video w-full object-cover",
          !hasVideo && "opacity-0"
        )}
      />
      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {getInitials(name)}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <p className="text-sm font-medium text-white">
          {name}
          {isLocal ? " (you)" : ""}
        </p>
        {!isLocal && hasAudio && !hasVideo && (
          <p className="text-xs text-emerald-300">Speaking nearby</p>
        )}
      </div>
    </div>
  );
}

export function VideoGrid({
  localUser,
  users,
  localStream,
  remoteStreams,
}: VideoGridProps) {
  const nearbyUsers = users
    .filter((user) => user.id !== localUser.id)
    .map((user) => ({
      user,
      dist: distance(localUser, user),
      volume: getAudioVolume(distance(localUser, user)),
    }))
    .filter(({ dist }) => dist <= 180)
    .sort((a, b) => a.dist - b.dist);

  const tiles = [
    {
      id: localUser.id,
      name: localUser.name,
      color: localUser.color,
      stream: localStream,
      isLocal: true,
      volume: 1,
    },
    ...nearbyUsers.map(({ user, volume }) => ({
      id: user.id,
      name: user.name,
      color: user.color,
      stream: remoteStreams.get(user.id) ?? null,
      isLocal: false,
      volume,
    })),
  ];

  if (tiles.length === 1 && !localStream) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-zinc-400">
        Walk near teammates to start spatial conversations. Enable your camera or mic from
        the toolbar below.
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "grid gap-3",
        tiles.length === 1 && "grid-cols-1",
        tiles.length === 2 && "grid-cols-2",
        tiles.length >= 3 && "grid-cols-2 xl:grid-cols-3"
      )}
    >
      {tiles.map((tile) => (
        <VideoTile
          key={tile.id}
          name={tile.name}
          color={tile.color}
          stream={tile.stream}
          muted={tile.isLocal}
          volume={tile.volume}
          isLocal={tile.isLocal}
        />
      ))}
    </div>
  );
}
