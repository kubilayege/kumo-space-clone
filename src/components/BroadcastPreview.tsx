"use client";

import { Eraser, Minimize2, Monitor } from "lucide-react";
import { useEffect, useRef } from "react";
import { ScreenAnnotation } from "@/components/ScreenAnnotation";
import { DrawStroke } from "@/lib/annotations";

interface BroadcastPreviewProps {
  stream: MediaStream;
  onMinimize: () => void;
  broadcasterId: string;
  strokes: DrawStroke[];
  onClear: (targetId: string) => void;
}

export function BroadcastPreview({
  stream,
  onMinimize,
  broadcasterId,
  strokes,
  onClear,
}: BroadcastPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrackId = stream.getVideoTracks()[0]?.id ?? null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream, videoTrackId]);

  const hasStrokes = strokes.length > 0;

  return (
    <div className="pointer-events-none absolute bottom-24 left-4 z-[45] w-[min(100%,360px)]">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-violet-400/25 bg-black/90 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-violet-100">
            <Monitor className="h-3.5 w-3.5" />
            {hasStrokes ? "Markup from viewers" : "Your broadcast"}
          </span>
          <div className="flex items-center gap-1">
            {hasStrokes && (
              <button
                type="button"
                onClick={() => onClear(broadcasterId)}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Clear annotations"
                title="Clear annotations"
              >
                <Eraser className="h-3 w-3" />
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onMinimize}
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Minimize preview"
              title="Minimize (keeps sharing)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
          {hasStrokes && (
            <ScreenAnnotation
              targetId={broadcasterId}
              strokes={strokes}
              localUserId={broadcasterId}
              activeColor="#facc15"
              interactive={false}
              onStroke={() => {}}
              onClear={onClear}
              onColorChange={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
