export function stopMediaTrack(track: MediaStreamTrack | null | undefined) {
  if (!track || track.readyState === "ended") return;
  track.stop();
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    stopMediaTrack(track);
  }
}

export function liveTrack(track: MediaStreamTrack | null | undefined): MediaStreamTrack | null {
  if (track?.readyState === "live") return track;
  return null;
}
