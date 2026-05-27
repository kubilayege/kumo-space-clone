import {
  ScreenShareQualityPreset,
  buildShareVideoConstraints,
} from "./screenShareQuality";

export type ScreenShareSurface = "monitor" | "window" | "browser";

// `contentHint` is the canonical WebRTC API for letting peers know what an
// audio track carries semantically. We use it to tag tracks at the sender
// side so receivers can route them to the right `<audio>` element.
//   - "speech" => microphone (voice)
//   - "music"  => system / screen audio (broadcast)
// Both are valid per the WebRTC spec; browsers without support simply
// keep the empty default, in which case viewers fall back to track order
// to disambiguate.
export const MIC_AUDIO_HINT = "speech" as const;
export const SCREEN_AUDIO_HINT = "music" as const;

export type AudioTrackKind = "mic" | "screen";

export function tagMicTrack(track: MediaStreamTrack | null | undefined) {
  if (!track || track.kind !== "audio") return;
  try {
    track.contentHint = MIC_AUDIO_HINT;
  } catch {
    // Older browsers may forbid setting this; we degrade to track order.
  }
}

export function tagScreenAudioTrack(track: MediaStreamTrack | null | undefined) {
  if (!track || track.kind !== "audio") return;
  try {
    track.contentHint = SCREEN_AUDIO_HINT;
  } catch {
    // ignore
  }
}

export function classifyAudioTrack(track: MediaStreamTrack): AudioTrackKind {
  if (track.contentHint === SCREEN_AUDIO_HINT) return "screen";
  return "mic";
}

// Screen capture relies on getDisplayMedia, which mobile browsers (iOS Safari,
// Android Chrome) do not implement. Detect it so the UI can degrade gracefully
// instead of failing silently when the user taps Share.
export function isScreenShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  );
}

export async function captureDisplay(
  surface: ScreenShareSurface | undefined,
  quality: ScreenShareQualityPreset
): Promise<MediaStream> {
  const video = buildShareVideoConstraints(quality, surface);

  return navigator.mediaDevices.getDisplayMedia({
    video,
    audio: {
      suppressLocalAudioPlayback: false,
    } as MediaTrackConstraints,
  });
}

export function detachAudioTracks(stream: MediaStream): MediaStreamTrack[] {
  const tracks = [...stream.getAudioTracks()];
  for (const track of tracks) {
    stream.removeTrack(track);
  }
  return tracks;
}

export function stopTracks(tracks: MediaStreamTrack[]) {
  for (const track of tracks) {
    track.stop();
  }
}

// Replace the audio tracks on `stream` with `nextTracks`, leaving any video
// tracks untouched. Stops any existing audio tracks that are not in the
// `nextTracks` list (to avoid leaking mic/screen-audio captures).
export function setStreamAudioTracks(
  stream: MediaStream,
  nextTracks: MediaStreamTrack[]
) {
  const nextIds = new Set(nextTracks.map((t) => t.id));
  for (const existing of stream.getAudioTracks()) {
    if (!nextIds.has(existing.id)) {
      stream.removeTrack(existing);
      existing.stop();
    }
  }
  for (const track of nextTracks) {
    if (!stream.getAudioTracks().some((t) => t.id === track.id)) {
      stream.addTrack(track);
    }
  }
}

export function swapVideoTrack(stream: MediaStream, nextVideo: MediaStreamTrack) {
  for (const track of stream.getVideoTracks()) {
    if (track.id !== nextVideo.id) {
      track.stop();
      stream.removeTrack(track);
    }
  }
  if (!stream.getVideoTracks().some((t) => t.id === nextVideo.id)) {
    stream.addTrack(nextVideo);
  }
}

export function clearVideoTracks(stream: MediaStream) {
  for (const track of stream.getVideoTracks()) {
    track.stop();
    stream.removeTrack(track);
  }
}
