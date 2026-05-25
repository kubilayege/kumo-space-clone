"use client";

import { useEffect, useRef } from "react";
import { User, distance, getAudioVolume } from "@/lib/types";

interface SpatialAudioProps {
  localUser: User;
  users: User[];
  remoteStreams: Map<string, MediaStream>;
}

function PeerAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.volume = volume;
    void el.play().catch(() => {});
  }, [stream, volume]);

  return <audio ref={ref} autoPlay playsInline />;
}

export function SpatialAudio({ localUser, users, remoteStreams }: SpatialAudioProps) {
  return (
    <div aria-hidden className="sr-only">
      {users
        .filter((u) => u.id !== localUser.id)
        .map((user) => {
          const stream = remoteStreams.get(user.id);
          if (!stream) return null;
          const volume = getAudioVolume(distance(localUser, user));
          return <PeerAudio key={user.id} stream={stream} volume={volume} />;
        })}
    </div>
  );
}
