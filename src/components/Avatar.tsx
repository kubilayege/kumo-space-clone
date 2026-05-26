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
  available: "bg-emerald-400",
  busy: "bg-rose-400",
  away: "bg-amber-400",
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
        {/* Outer halo / proximity ring for local */}
        {isLocal && (
          <span className="absolute inset-0 -m-1 rounded-full bg-white/20 blur-md" />
        )}

        {/* Speaking ring (animated) */}
        {isSpeaking && (
          <span className="absolute inset-0 -m-1 rounded-full ring-2 ring-emerald-400/70 speak-pulse" />
        )}

        {isPresenting && (
          <span className="absolute inset-0 -m-1 rounded-full ring-2 ring-violet-400/70" />
        )}

        {/* Avatar body */}
        <div
          className={clsx(
            "relative flex items-center justify-center rounded-full font-semibold text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]",
            s.circle,
            s.text,
            isLocal ? "ring-2 ring-white" : "ring-2 ring-white/15"
          )}
          style={{ backgroundColor: user.color }}
        >
          {/* Subtle gradient overlay for depth */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-white/0 to-black/15" />
          <span className="relative drop-shadow-sm">{getInitials(user.name)}</span>

          {/* Status dot */}
          <span
            className={clsx(
              "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#0c0c16]",
              s.status,
              statusColors[user.status]
            )}
          />
        </div>

        {/* Floor shadow */}
        <span
          className="pointer-events-none absolute left-1/2 top-full h-1.5 w-8 -translate-x-1/2 translate-y-1 rounded-full bg-black/40 blur-sm"
          aria-hidden
        />
      </div>

      {/* Name plate */}
      <div className="mt-2.5 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
        <span>
          {user.name}
          {isLocal && <span className="ml-1 text-indigo-300">· you</span>}
        </span>

        <span className="flex items-center gap-0.5 text-zinc-400">
          {user.micEnabled ? (
            <Mic className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
          ) : (
            <MicOff className="h-3 w-3 text-zinc-500" strokeWidth={2.5} />
          )}
          {user.cameraEnabled && <Camera className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />}
          {user.screenSharing && (
            <Monitor className="h-3 w-3 text-violet-300" strokeWidth={2.5} />
          )}
        </span>
      </div>

      {/* Zone label (local only) */}
      {zoneName && isLocal && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-indigo-300/80">
          {zoneName}
        </div>
      )}
    </div>
  );
}
