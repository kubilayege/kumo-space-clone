"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  PanelRight,
} from "lucide-react";
import { User, UserStatus } from "@/lib/types";

interface ControlBarProps {
  localUser: User;
  micEnabled: boolean;
  cameraEnabled: boolean;
  sidebarOpen: boolean;
  chatHasUnread?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSidebar: () => void;
  onStatusChange: (status: UserStatus) => void;
  onLeave: () => void;
}

const STATUSES: { value: UserStatus; label: string; dotClass: string }[] = [
  { value: "available", label: "Available", dotClass: "bg-emerald-400" },
  { value: "busy", label: "Busy", dotClass: "bg-rose-400" },
  { value: "away", label: "Away", dotClass: "bg-amber-400" },
];

export function ControlBar({
  localUser,
  micEnabled,
  cameraEnabled,
  sidebarOpen,
  onToggleMic,
  onToggleCamera,
  onToggleSidebar,
  onStatusChange,
  onLeave,
}: ControlBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusOpen]);

  const currentStatus = STATUSES.find((s) => s.value === localUser.status) ?? STATUSES[0];

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-black/55 p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {/* Status pill with dropdown */}
        <div ref={statusRef} className="relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <span className={clsx("h-2 w-2 rounded-full", currentStatus.dotClass)} />
            <span>{currentStatus.label}</span>
            <ChevronDown
              className={clsx(
                "h-3 w-3 text-zinc-400 transition-transform",
                statusOpen && "rotate-180"
              )}
            />
          </button>

          {statusOpen && (
            <div className="absolute bottom-full left-0 mb-2 min-w-[160px] origin-bottom-left rounded-xl border border-white/[0.08] bg-[#11111c]/95 p-1 shadow-2xl backdrop-blur-xl animate-scale-in">
              {STATUSES.map((status) => (
                <button
                  key={status.value}
                  onClick={() => {
                    onStatusChange(status.value);
                    setStatusOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2">
                    <span className={clsx("h-2 w-2 rounded-full", status.dotClass)} />
                    {status.label}
                  </span>
                  {status.value === currentStatus.value && (
                    <Check className="h-3.5 w-3.5 text-indigo-300" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Mic */}
        <ToggleButton
          active={micEnabled}
          onClick={onToggleMic}
          label={micEnabled ? "Mute" : "Unmute"}
          icon={micEnabled ? Mic : MicOff}
          dangerWhenOff
        />

        {/* Camera */}
        <ToggleButton
          active={cameraEnabled}
          onClick={onToggleCamera}
          label={cameraEnabled ? "Stop camera" : "Start camera"}
          icon={cameraEnabled ? Camera : CameraOff}
        />

        <Divider />

        {/* Sidebar / Chat toggle */}
        <ToggleButton
          active={sidebarOpen}
          onClick={onToggleSidebar}
          label="Toggle panel"
          icon={sidebarOpen ? PanelRight : MessageSquare}
          tone="indigo"
        />

        <Divider />

        {/* Leave */}
        <button
          onClick={onLeave}
          className="group flex h-9 items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 text-[12px] font-medium text-rose-200 transition hover:bg-rose-500/25"
        >
          <LogOut className="h-3.5 w-3.5" />
          Leave
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px bg-white/[0.08]" />;
}

function ToggleButton({
  active,
  onClick,
  label,
  icon: Icon,
  dangerWhenOff,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  dangerWhenOff?: boolean;
  tone?: "default" | "indigo";
}) {
  const activeStyle =
    tone === "indigo"
      ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30"
      : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25";
  const inactiveStyle = dangerWhenOff
    ? "bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
    : "bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]";

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-xl transition",
        active ? activeStyle : inactiveStyle
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.2} />
    </button>
  );
}
