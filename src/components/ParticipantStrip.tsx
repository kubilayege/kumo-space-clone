"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { MicOff, Monitor } from "lucide-react";
import { User, getInitials } from "@/lib/types";

export interface ParticipantStripItem {
  id: string;
  user: User;
  stream: MediaStream | null;
  isLocal: boolean;
  volume: number;
  isPresenter: boolean;
  audioMuted: boolean;
}

interface ParticipantStripProps {
  items: ParticipantStripItem[];
  focusedId: string | null;
  onSelect: (id: string) => void;
  maxVisible?: number;
}

export function ParticipantStrip({
  items,
  focusedId,
  onSelect,
  maxVisible = 6,
}: ParticipantStripProps) {
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {visible.map((item) => (
        <ParticipantThumb
          key={item.id}
          item={item}
          isFocused={item.id === focusedId}
          onSelect={() => onSelect(item.id)}
        />
      ))}
      {overflow > 0 && (
        <div className="flex h-[68px] w-[88px] shrink-0 flex-col items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-zinc-400">
          <span className="text-[14px] font-semibold text-white">+{overflow}</span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">more</span>
        </div>
      )}
    </div>
  );
}

function ParticipantThumb({
  item,
  isFocused,
  onSelect,
}: {
  item: ParticipantStripItem;
  isFocused: boolean;
  onSelect: () => void;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const videoTrackId = item.stream?.getVideoTracks()[0]?.id ?? null;

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.srcObject = item.stream;
    element.volume = 0;
    if (item.stream) {
      void element.play().catch(() => {});
    }
  }, [item.stream, videoTrackId]);

  const hasVideo =
    !!item.stream &&
    item.stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);

  const speaking =
    !item.audioMuted && item.user.micEnabled && (item.isLocal || item.volume > 0.01);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={item.user.name + (item.isLocal ? " (you)" : "")}
      className={clsx(
        "group relative flex h-[68px] w-[88px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-zinc-950/80 transition-all",
        isFocused
          ? "border-violet-400/60 ring-2 ring-violet-400/50"
          : speaking
            ? "border-emerald-400/45 ring-2 ring-emerald-400/35"
            : "border-white/[0.1] hover:border-white/25"
      )}
    >
      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted
        className={clsx(
          "h-full w-full object-cover",
          item.isPresenter && "object-contain bg-black",
          !hasVideo && "opacity-0"
        )}
      />

      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(145deg, ${item.user.color}dd 0%, ${item.user.color}88 45%, #09090b 100%)`,
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-md ring-2 ring-white/30"
            style={{ backgroundColor: item.user.color }}
          >
            {getInitials(item.user.name)}
          </span>
        </div>
      )}

      {item.isPresenter && (
        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full border border-violet-400/40 bg-violet-500/30 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-violet-100 backdrop-blur-md">
          <Monitor className="h-2 w-2" />
          live
        </span>
      )}

      {!item.user.micEnabled && (
        <span className="absolute right-1 top-1 rounded-full border border-rose-400/30 bg-black/65 p-0.5 backdrop-blur-md">
          <MicOff className="h-2.5 w-2.5 text-rose-300" />
        </span>
      )}

      <div
        className={clsx(
          "pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-1.5 pb-1 pt-3",
          isFocused && "from-violet-950/95"
        )}
      >
        <span className="truncate text-[9px] font-medium text-white drop-shadow-sm">
          {item.isLocal ? "You" : item.user.name}
        </span>
        {speaking && (
          <span className="flex shrink-0 items-end gap-[1.5px]">
            {[0, 0.15, 0.3].map((delay, i) => (
              <span
                key={i}
                className="block w-[2px] rounded-full bg-emerald-400 audio-bar"
                style={{ height: 5 + i * 2, animationDelay: `${delay}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </button>
  );
}
