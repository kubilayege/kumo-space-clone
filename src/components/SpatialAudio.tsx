"use client";

import { useEffect, useMemo, useRef } from "react";
import { classifyAudioTrack } from "@/lib/screenShare";
import {
  User,
  distance,
  getAudioVolume,
  getScreenSharePresence,
  isNearby,
} from "@/lib/types";

interface SpatialAudioProps {
  localUser: User;
  users: User[];
  remoteStreams: Map<string, MediaStream>;
  peerMicMuted: ReadonlySet<string>;
  peerScreenAudioMuted: ReadonlySet<string>;
}

interface AudioPresence {
  hasMic: boolean;
  hasScreenAudio: boolean;
}

// Inspect the live audio tracks on a peer's MediaStream and report which
// kinds the broadcaster is currently sending. Used by VideoGrid to decide
// which mute controls to render.
export function getPeerAudioPresence(
  user: User,
  stream: MediaStream | null | undefined
): AudioPresence {
  if (!stream) return { hasMic: false, hasScreenAudio: false };

  let hasMic = false;
  let hasScreenAudio = false;

  for (const track of stream.getAudioTracks()) {
    if (track.readyState !== "live") continue;
    if (classifyAudioTrack(track) === "screen") hasScreenAudio = true;
    else hasMic = true;
  }

  if (user.screenSharing && user.screenAudioEnabled && !hasScreenAudio) {
    // The broadcaster told us they have screen audio but we haven't tagged
    // any live track yet — assume the highest-numbered audio track is the
    // screen one (it's added second by the sender) as a fallback.
    const audioTracks = stream
      .getAudioTracks()
      .filter((t) => t.readyState === "live");
    if (audioTracks.length >= 2) hasScreenAudio = true;
  }

  return { hasMic, hasScreenAudio };
}

// True iff this peer is currently sending *any* audible track we should
// render — kept around for legacy callers (e.g. VideoGrid badges) that
// don't care about the mic/screen split.
export function peerShouldPlayAudio(user: User, stream: MediaStream): boolean {
  const liveAudio = stream.getAudioTracks().some((t) => t.readyState === "live");
  if (!liveAudio) return false;
  if (user.screenSharing) return true;
  return user.micEnabled;
}

// Picks the matching track from a stream by classification, falling back to
// position-based heuristics when tracks aren't tagged (older browsers).
function pickTrackForKind(
  stream: MediaStream,
  kind: "mic" | "screen"
): MediaStreamTrack | null {
  const liveTracks = stream
    .getAudioTracks()
    .filter((t) => t.readyState === "live");
  if (liveTracks.length === 0) return null;

  const tagged = liveTracks.find((t) => classifyAudioTrack(t) === kind);
  if (tagged) return tagged;

  // Untagged fallback: by convention the sender adds the mic first and
  // the screen audio second.
  if (liveTracks.length === 1) {
    return kind === "mic" ? liveTracks[0] : null;
  }
  return kind === "mic" ? liveTracks[0] : liveTracks[liveTracks.length - 1];
}

function PeerAudioTrack({
  track,
  volume,
}: {
  track: MediaStreamTrack;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (volume <= 0) {
      el.pause();
      el.srcObject = null;
      return;
    }

    const audible = new MediaStream([track]);
    if (el.srcObject !== audible) {
      el.srcObject = audible;
    }
    el.volume = volume;
    el.muted = false;
    void el.play().catch(() => {});
  }, [track, volume]);

  if (volume <= 0) return null;

  return <audio ref={ref} autoPlay playsInline />;
}

export function SpatialAudio({
  localUser,
  users,
  remoteStreams,
  peerMicMuted,
  peerScreenAudioMuted,
}: SpatialAudioProps) {
  // Re-render whenever any peer's stream identity changes so we can pick up
  // newly tagged tracks. We capture stream identities via `useMemo` so the
  // render cycle stays cheap.
  const peerEntries = useMemo(() => {
    return users
      .filter((u) => u.id !== localUser.id)
      .map((user) => {
        const stream = remoteStreams.get(user.id);
        return { user, stream };
      });
  }, [users, remoteStreams, localUser.id]);

  return (
    <div aria-hidden className="sr-only">
      {peerEntries.map(({ user, stream }) => {
        if (!stream) return null;

        const dist = distance(localUser, user);
        const baseVoiceVolume = isNearby(localUser, user)
          ? getAudioVolume(dist)
          : 0;
        const shareVolume = user.screenSharing
          ? getScreenSharePresence(dist)
          : 0;

        const micTrack = user.micEnabled ? pickTrackForKind(stream, "mic") : null;
        const screenTrack =
          user.screenSharing && user.screenAudioEnabled
            ? pickTrackForKind(stream, "screen")
            : null;

        // When the broadcaster is sharing, voice should still ride the
        // close-range falloff but also stay audible from the share range
        // (matches the previous merged behaviour).
        const micVolume =
          peerMicMuted.has(user.id) || !micTrack
            ? 0
            : user.screenSharing
              ? Math.max(baseVoiceVolume, shareVolume)
              : baseVoiceVolume;

        const screenVolume =
          peerScreenAudioMuted.has(user.id) || !screenTrack ? 0 : shareVolume;

        return (
          <div key={user.id}>
            {micTrack && (
              <PeerAudioTrack track={micTrack} volume={micVolume} />
            )}
            {screenTrack && (
              <PeerAudioTrack track={screenTrack} volume={screenVolume} />
            )}
          </div>
        );
      })}
    </div>
  );
}
