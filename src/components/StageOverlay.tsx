"use client";

import clsx from "clsx";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  PencilLine,
  Volume2,
  VolumeX,
} from "lucide-react";
import { User } from "@/lib/types";

interface StageOverlayProps {
  presenter: User;
  isLocalPresenter: boolean;
  viewerCount: number;
  isScreenShare: boolean;
  hasIncomingMic: boolean;
  hasIncomingScreenAudio: boolean;
  micMuted: boolean;
  screenAudioMuted: boolean;
  onToggleAudioMute?: (kind: "mic" | "screen") => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  annotateDrawing: boolean;
  canAnnotate: boolean;
  onToggleAnnotate?: () => void;
  proximityHint?: string | null;
}

export function StageOverlay({
  presenter,
  isLocalPresenter,
  viewerCount,
  isScreenShare,
  hasIncomingMic,
  hasIncomingScreenAudio,
  micMuted,
  screenAudioMuted,
  onToggleAudioMute,
  isFullscreen,
  onToggleFullscreen,
  annotateDrawing,
  canAnnotate,
  onToggleAnnotate,
  proximityHint,
}: StageOverlayProps) {
  return (
    <>
      {/* Top-left presenter badge */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-[14] flex max-w-[60%] items-center gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-black/70 px-2 py-1 backdrop-blur-md">
          {isScreenShare && (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
              </span>
              <Monitor className="h-2.5 w-2.5" />
              Live
            </span>
          )}
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-1 ring-white/20"
            style={{ backgroundColor: presenter.color }}
          >
            {presenter.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[11px] font-medium text-white">
            {presenter.name}
            {isLocalPresenter && (
              <span className="ml-1 font-normal text-indigo-300/90">· you</span>
            )}
          </span>
          {viewerCount > 0 && (
            <span className="ml-0.5 hidden shrink-0 text-[10px] tabular-nums text-zinc-400 sm:inline">
              · {viewerCount} watching
            </span>
          )}
        </div>
      </div>

      {/* Top-right action cluster */}
      <div className="pointer-events-none absolute right-2.5 top-2.5 z-[14] flex items-center gap-1">
        {hasIncomingMic && onToggleAudioMute && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleAudioMute("mic");
            }}
            title={micMuted ? "Unmute voice" : "Mute voice"}
            aria-label={micMuted ? "Unmute voice" : "Mute voice"}
            className={clsx(
              "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition hover:bg-black/80",
              micMuted
                ? "border-rose-400/30 bg-rose-500/25 text-rose-100"
                : "border-white/10 bg-black/60 text-white"
            )}
          >
            {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        )}
        {hasIncomingScreenAudio && onToggleAudioMute && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleAudioMute("screen");
            }}
            title={screenAudioMuted ? "Unmute broadcast audio" : "Mute broadcast audio"}
            aria-label={screenAudioMuted ? "Unmute broadcast audio" : "Mute broadcast audio"}
            className={clsx(
              "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition hover:bg-black/80",
              screenAudioMuted
                ? "border-rose-400/30 bg-rose-500/25 text-rose-100"
                : "border-white/10 bg-black/60 text-white"
            )}
          >
            {screenAudioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}
        {canAnnotate && onToggleAnnotate && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleAnnotate();
            }}
            title={annotateDrawing ? "Stop drawing" : "Draw on screen"}
            aria-label={annotateDrawing ? "Stop drawing" : "Draw on screen"}
            className={clsx(
              "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition hover:bg-black/80",
              annotateDrawing
                ? "border-amber-400/35 bg-amber-500/25 text-amber-100"
                : "border-white/10 bg-black/60 text-white"
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFullscreen();
          }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Proximity / context hint at top center */}
      {proximityHint && (
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-[13] -translate-x-1/2">
          <span className="rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-md">
            {proximityHint}
          </span>
        </div>
      )}
    </>
  );
}
