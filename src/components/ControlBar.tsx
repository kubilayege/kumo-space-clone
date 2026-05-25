"use client";

import clsx from "clsx";
import {
  Camera,
  CameraOff,
  ChevronLeft,
  MessageSquare,
  Mic,
  MicOff,
  Users,
} from "lucide-react";
import { User, UserStatus } from "@/lib/types";

interface ControlBarProps {
  localUser: User;
  userCount: number;
  micEnabled: boolean;
  cameraEnabled: boolean;
  chatOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  onStatusChange: (status: UserStatus) => void;
  onLeave: () => void;
  spaceId: string;
}

const statuses: { value: UserStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "bg-emerald-400" },
  { value: "busy", label: "Busy", color: "bg-rose-400" },
  { value: "away", label: "Away", color: "bg-amber-400" },
];

export function ControlBar({
  localUser,
  userCount,
  micEnabled,
  cameraEnabled,
  chatOpen,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onStatusChange,
  onLeave,
  spaceId,
}: ControlBarProps) {
  return (
    <div className="border-t border-white/10 bg-[#12121a]/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeave}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Leave
          </button>
          <div>
            <p className="font-medium text-white">{spaceId}</p>
            <p className="flex items-center gap-1 text-sm text-zinc-400">
              <Users className="h-4 w-4" />
              {userCount} online
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => onStatusChange(status.value)}
              className={clsx(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition",
                localUser.status === status.value
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className={clsx("h-2.5 w-2.5 rounded-full", status.color)} />
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleMic}
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl transition",
              micEnabled
                ? "bg-indigo-500 text-white hover:bg-indigo-400"
                : "bg-white/10 text-zinc-300 hover:bg-white/15"
            )}
            aria-label="Toggle microphone"
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            onClick={onToggleCamera}
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl transition",
              cameraEnabled
                ? "bg-indigo-500 text-white hover:bg-indigo-400"
                : "bg-white/10 text-zinc-300 hover:bg-white/15"
            )}
            aria-label="Toggle camera"
          >
            {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>
          <button
            onClick={onToggleChat}
            className={clsx(
              "hidden h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition lg:flex",
              chatOpen
                ? "bg-indigo-500 text-white"
                : "bg-white/10 text-zinc-300 hover:bg-white/15 hover:text-white"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}
