"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  AppWindow,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PanelRight,
  PencilLine,
  RectangleHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { ScreenShareSurface } from "@/lib/screenShare";
import {
  SCREEN_SHARE_QUALITIES,
  ScreenShareQualityId,
} from "@/lib/screenShareQuality";
import { User, UserStatus } from "@/lib/types";

interface ControlBarProps {
  localUser: User;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  screenShareQuality: ScreenShareQualityId;
  onScreenShareQualityChange: (quality: ScreenShareQualityId) => void;
  sidebarOpen: boolean;
  chatHasUnread?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: (surface?: ScreenShareSurface) => void;
  onStopScreenShare: () => void;
  anyonePresenting?: boolean;
  annotateDrawing?: boolean;
  onToggleAnnotateDrawing?: () => void;
  annotationColor?: string;
  onAnnotationColorChange?: (color: string) => void;
  onToggleSidebar: () => void;
  onStatusChange: (status: UserStatus) => void;
  onLeave: () => void;
}

const STATUSES: { value: UserStatus; label: string; dotClass: string }[] = [
  { value: "available", label: "Available", dotClass: "bg-[var(--status-ok)]" },
  { value: "busy", label: "Busy", dotClass: "bg-[var(--status-busy)]" },
  { value: "away", label: "Away", dotClass: "bg-[var(--status-away)]" },
];

const SHARE_OPTIONS: {
  surface?: ScreenShareSurface;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    surface: "monitor",
    label: "Entire screen",
    hint: "All displays",
    icon: Monitor,
  },
  {
    surface: "window",
    label: "Window",
    hint: "One app window",
    icon: AppWindow,
  },
  {
    surface: "browser",
    label: "Browser tab",
    hint: "Single tab",
    icon: RectangleHorizontal,
  },
];

export function ControlBar({
  localUser,
  micEnabled,
  cameraEnabled,
  screenSharing,
  screenShareQuality,
  onScreenShareQualityChange,
  sidebarOpen,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  anyonePresenting = false,
  annotateDrawing = false,
  onToggleAnnotateDrawing,
  annotationColor,
  onAnnotationColorChange,
  onToggleSidebar,
  onStatusChange,
  onLeave,
}: ControlBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusOpen && !shareOpen && !qualityOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusOpen && statusRef.current && !statusRef.current.contains(target)) {
        setStatusOpen(false);
      }
      if (shareOpen && shareRef.current && !shareRef.current.contains(target)) {
        setShareOpen(false);
      }
      if (qualityOpen && shareRef.current && !shareRef.current.contains(target)) {
        setQualityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusOpen, shareOpen, qualityOpen]);

  const currentStatus = STATUSES.find((s) => s.value === localUser.status) ?? STATUSES[0];

  const handleSharePick = (surface?: ScreenShareSurface) => {
    setShareOpen(false);
    onStartScreenShare(surface);
  };

  return (
    <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
      <div className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)] sm:gap-1 sm:p-2">
        <div ref={statusRef} className="relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--paper-2)] sm:gap-2 sm:px-3"
          >
            <span className={clsx("h-2 w-2 rounded-full", currentStatus.dotClass)} />
            <span className="hidden sm:inline">{currentStatus.label}</span>
            <ChevronDown
              className={clsx(
                "h-3 w-3 text-[var(--ink-faint)] transition-transform",
                statusOpen && "rotate-180"
              )}
            />
          </button>

          {statusOpen && (
            <div className="absolute bottom-full left-0 mb-2 min-w-[160px] origin-bottom-left rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)] animate-scale-in">
              {STATUSES.map((status) => (
                <button
                  key={status.value}
                  onClick={() => {
                    onStatusChange(status.value);
                    setStatusOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--paper-2)]"
                >
                  <span className="flex items-center gap-2">
                    <span className={clsx("h-2 w-2 rounded-full", status.dotClass)} />
                    {status.label}
                  </span>
                  {status.value === currentStatus.value && (
                    <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        <ToggleButton
          active={micEnabled}
          onClick={onToggleMic}
          label={micEnabled ? "Mute" : "Unmute"}
          icon={micEnabled ? Mic : MicOff}
          dangerWhenOff
        />

        <ToggleButton
          active={cameraEnabled && !screenSharing}
          onClick={onToggleCamera}
          label={cameraEnabled ? "Stop camera" : "Start camera"}
          icon={cameraEnabled ? Camera : CameraOff}
          disabled={screenSharing}
        />

        <div ref={shareRef} className="relative flex items-center gap-0.5">
          {screenSharing ? (
            <>
              <button
                type="button"
                onClick={onStopScreenShare}
                className="flex h-9 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-2.5 text-[12px] font-semibold text-[var(--accent-hover)] ring-1 ring-[var(--accent)]/30 transition hover:bg-[var(--accent)]/15 sm:px-3"
              >
                <MonitorOff className="h-4 w-4" />
                <span className="hidden sm:inline">Stop sharing</span>
              </button>
              <ToggleButton
                active={qualityOpen}
                onClick={() => setQualityOpen((v) => !v)}
                label="Stream quality"
                icon={SlidersHorizontal}
                tone="accent"
              />
              {qualityOpen && (
                <div className="absolute bottom-full left-1/2 mb-2 w-[240px] -translate-x-1/2 origin-bottom rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)] animate-scale-in">
                  <ShareQualityPanel
                    quality={screenShareQuality}
                    onChange={(id) => {
                      onScreenShareQualityChange(id);
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <ToggleButton
                active={shareOpen}
                onClick={() => setShareOpen((v) => !v)}
                label="Share screen"
                icon={Monitor}
                tone="accent"
              />
              {shareOpen && (
                <div className="absolute bottom-full left-1/2 mb-2 w-[240px] -translate-x-1/2 origin-bottom rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)] animate-scale-in">
                  <ShareQualityPanel
                    quality={screenShareQuality}
                    onChange={onScreenShareQualityChange}
                    className="border-b border-[var(--line)] pb-1"
                  />
                  {SHARE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleSharePick(option.surface)}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-[var(--paper-2)]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                        <option.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[12px] font-medium text-[var(--ink)]">
                          {option.label}
                        </span>
                        <span className="block text-[10px] text-[var(--ink-faint)]">{option.hint}</span>
                      </span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-[var(--line)]" />
                  <button
                    onClick={() => handleSharePick()}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                  >
                    Or choose in system picker…
                  </button>
                  <p className="px-2.5 pb-1 pt-1 text-[10px] leading-relaxed text-[var(--ink-faint)]">
                    In the browser dialog, enable share audio (tab audio works best).
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {anyonePresenting && !screenSharing && onToggleAnnotateDrawing && (
          <>
            <Divider />
            <ToggleButton
              active={annotateDrawing}
              onClick={onToggleAnnotateDrawing}
              label={annotateDrawing ? "Stop drawing on screen" : "Draw on screen share"}
              icon={PencilLine}
              tone="accent"
            />
            {annotateDrawing && annotationColor && onAnnotationColorChange && (
              <AnnotationToolbar
                activeColor={annotationColor}
                onColorChange={onAnnotationColorChange}
                variant="dock"
              />
            )}
          </>
        )}

        <Divider />

        <ToggleButton
          active={sidebarOpen}
          onClick={onToggleSidebar}
          label="Toggle panel"
          icon={sidebarOpen ? PanelRight : MessageSquare}
          tone="accent"
        />

        <Divider />

        <button
          onClick={onLeave}
          className="group flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)] sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}

function ShareQualityPanel({
  quality,
  onChange,
  className,
}: {
  quality: ScreenShareQualityId;
  onChange: (quality: ScreenShareQualityId) => void;
  className?: string;
}) {
  return (
    <div className={clsx("p-1.5", className)}>
      <p className="px-1 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
        Stream quality
      </p>
      <div className="grid grid-cols-2 gap-1">
        {SCREEN_SHARE_QUALITIES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={clsx(
              "rounded-lg px-2 py-1.5 text-left transition",
              quality === preset.id
                ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/35"
                : "hover:bg-[var(--paper-2)]"
            )}
          >
            <span className="block text-[11px] font-medium text-[var(--ink)]">{preset.label}</span>
            <span className="block text-[10px] text-[var(--ink-faint)]">{preset.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px bg-[var(--line)]" />;
}

function ToggleButton({
  active,
  onClick,
  label,
  icon: Icon,
  dangerWhenOff,
  disabled,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  dangerWhenOff?: boolean;
  disabled?: boolean;
  tone?: "default" | "accent";
}) {
  const activeStyle =
    tone === "accent"
      ? "bg-[var(--accent)] text-white"
      : "bg-[var(--accent)] text-white";
  const inactiveStyle = dangerWhenOff
    ? "text-[var(--accent)] hover:bg-[var(--accent-soft)]"
    : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]";

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-full transition sm:h-10 sm:w-10",
        disabled && "cursor-not-allowed opacity-40",
        active ? activeStyle : inactiveStyle
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.2} />
    </button>
  );
}
