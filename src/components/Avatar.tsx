"use client";

import clsx from "clsx";
import { Camera, Mic, MicOff, Monitor } from "lucide-react";
import { User, getInitials } from "@/lib/types";

interface AvatarProps {
  user: User;
  isLocal?: boolean;
  isSpeaking?: boolean;
  isPresenting?: boolean;
  zoneName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { circle: "h-10 w-10", text: "text-[11px]", status: "h-2.5 w-2.5", indicator: "h-4 w-4" },
  md: { circle: "h-14 w-14", text: "text-sm", status: "h-3.5 w-3.5", indicator: "h-5 w-5" },
  lg: { circle: "h-16 w-16", text: "text-base", status: "h-4 w-4", indicator: "h-6 w-6" },
};

const statusColors: Record<User["status"], string> = {
  available: "bg-[var(--status-ok)]",
  busy: "bg-[var(--status-busy)]",
  away: "bg-[var(--status-away)]",
};

export function Avatar({
  user,
  isLocal = false,
  isSpeaking = false,
  isPresenting = false,
  zoneName,
  size = "md",
}: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Speaking ring (animated) */}
        {isSpeaking && (
          <span className="absolute inset-0 -m-1 rounded-full ring-2 ring-[var(--status-ok)]/70 speak-pulse" />
        )}

        {isPresenting && (
          <span className="absolute inset-0 -m-1 rounded-full ring-2 ring-[var(--accent)]/70" />
        )}

        {/* Avatar body */}
        <div
          className={clsx(
            "relative flex items-center justify-center rounded-full border-2 border-white font-semibold text-white shadow-[0_2px_8px_rgba(28,24,20,0.22)]",
            s.circle,
            s.text,
            isLocal && "shadow-[0_0_0_3px_var(--accent-ring),0_4px_10px_rgba(28,24,20,0.22)]"
          )}
          style={{ backgroundColor: user.color }}
        >
          {/* Subtle gradient overlay for depth */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-white/0 to-black/10" />
          <span className="relative drop-shadow-sm">{getInitials(user.name)}</span>

          {/* Status dot */}
          <span
            className={clsx(
              "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white",
              s.status,
              statusColors[user.status]
            )}
          />
        </div>

        {/* Floor shadow */}
        <span
          className="pointer-events-none absolute left-1/2 top-full h-1.5 w-8 -translate-x-1/2 translate-y-1 rounded-full bg-[rgba(28,24,20,0.18)] blur-sm"
          aria-hidden
        />
      </div>

      {/* Name plate */}
      <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-white/92 px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] shadow-[var(--shadow-sm)] backdrop-blur">
        <span>
          {user.name}
          {isLocal && <span className="ml-1 text-[var(--accent)]">· you</span>}
        </span>

        <span className="flex items-center gap-0.5 text-[var(--ink-faint)]">
          {user.micEnabled ? (
            <Mic className="h-3 w-3 text-[var(--status-ok)]" strokeWidth={2.5} />
          ) : (
            <MicOff className="h-3 w-3 text-[var(--ink-faint)]" strokeWidth={2.5} />
          )}
          {user.cameraEnabled && <Camera className="h-3 w-3 text-[var(--status-ok)]" strokeWidth={2.5} />}
          {user.screenSharing && (
            <Monitor className="h-3 w-3 text-[var(--accent)]" strokeWidth={2.5} />
          )}
        </span>
      </div>

      {/* Zone label (local only) */}
      {zoneName && isLocal && (
        <div className="mt-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--ink-faint)]">
          {zoneName}
        </div>
      )}
    </div>
  );
}
