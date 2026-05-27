"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  Radio,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import {
  ParticipantStrip,
  ParticipantStripItem,
} from "@/components/ParticipantStrip";
import { ScreenAnnotation } from "@/components/ScreenAnnotation";
import { StageOverlay } from "@/components/StageOverlay";
import { getPeerAudioPresence } from "@/components/SpatialAudio";
import { DrawStroke } from "@/lib/annotations";
import {
  AUDIO_RANGE,
  SCREEN_SHARE_VISIBLE_THRESHOLD,
  User,
  distance,
  getAudioVolume,
  getInitials,
  getScreenSharePresence,
  hasNearbyPresenter,
} from "@/lib/types";
import { ConnectionState } from "@/lib/webrtc";

interface VideoGridProps {
  localUser: User;
  localScreenSharing: boolean;
  users: User[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  peerStates: Map<string, ConnectionState>;
  peerMicMuted: ReadonlySet<string>;
  peerScreenAudioMuted: ReadonlySet<string>;
  onTogglePeerAudioMute: (userId: string, kind: "mic" | "screen") => void;
  annotations: Map<string, DrawStroke[]>;
  localUserId: string;
  annotationColor: string;
  onAnnotationColorChange: (color: string) => void;
  onAnnotationStroke: (stroke: DrawStroke) => void;
  onAnnotationClear: (targetId: string) => void;
  annotateDrawing: boolean;
  onToggleAnnotateDrawing?: () => void;
}

interface TileData {
  id: string;
  user: User;
  stream: MediaStream | null;
  isLocal: boolean;
  volume: number;
  connectionState?: ConnectionState;
  dist?: number;
  sharePresence?: number;
}

function pickDefaultStageFocus(
  participants: TileData[],
  localPresenting: boolean
): string | null {
  const shares = participants.filter((p) => p.user.screenSharing);
  const remoteShare = shares.find((p) => !p.isLocal);
  if (remoteShare) return remoteShare.id;
  if (shares.length > 0) return shares[0].id;
  if (localPresenting) {
    const local = participants.find((p) => p.isLocal);
    if (local) return local.id;
  }
  return participants[0]?.id ?? null;
}

function AudioBars({ active }: { active: boolean }) {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className={clsx(
            "block w-[3px] rounded-full bg-emerald-400",
            active ? "audio-bar" : "opacity-40"
          )}
          style={{
            height: 10 + i * 3,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </span>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;

  const config = {
    connecting: {
      className: "border-amber-400/30 bg-amber-500/20 text-amber-100",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
      label: "connecting",
    },
    new: {
      className: "border-zinc-500/30 bg-zinc-800/80 text-zinc-300",
      icon: <Wifi className="h-2.5 w-2.5" />,
      label: "starting",
    },
    failed: {
      className: "border-rose-400/30 bg-rose-500/25 text-rose-100",
      icon: <AlertCircle className="h-2.5 w-2.5" />,
      label: "failed",
    },
  }[state];

  if (!config) return null;

  return (
    <span
      className={clsx(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

interface StageTileProps {
  tile: TileData;
  micMuted: boolean;
  screenAudioMuted: boolean;
  onToggleAudioMute?: (kind: "mic" | "screen") => void;
  strokes: DrawStroke[];
  localUserId: string;
  annotationColor: string;
  onStroke: (stroke: DrawStroke) => void;
  onClear: (targetId: string) => void;
  onColorChange: (color: string) => void;
  annotateDrawing: boolean;
  canAnnotate: boolean;
  onToggleAnnotateDrawing?: () => void;
  viewerCount: number;
  proximityHint: string | null;
}

function StageTile({
  tile,
  micMuted,
  screenAudioMuted,
  onToggleAudioMute,
  strokes,
  localUserId,
  annotationColor,
  onStroke,
  onClear,
  onColorChange,
  annotateDrawing,
  canAnnotate,
  onToggleAnnotateDrawing,
  viewerCount,
  proximityHint,
}: StageTileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoTrackId = tile.stream?.getVideoTracks()[0]?.id ?? null;

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.srcObject = tile.stream;
    element.volume = 0;
    if (tile.stream) {
      void element.play().catch(() => {});
    }
  }, [tile.stream, videoTrackId]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const video = mediaRef.current;
      const container = tileRef.current;
      setIsFullscreen(
        document.fullscreenElement === video ||
          document.fullscreenElement === container
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    const video = mediaRef.current;
    const container = tileRef.current;
    if (!video && !container) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    if (video?.requestFullscreen) {
      void video.requestFullscreen().catch(() => {
        if (container) void container.requestFullscreen();
      });
      return;
    }
    if (container) void container.requestFullscreen();
  };

  const hasVideo =
    !!tile.stream &&
    tile.stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

  const isScreenShare = tile.user.screenSharing;
  const presence = !tile.isLocal
    ? getPeerAudioPresence(tile.user, tile.stream)
    : { hasMic: false, hasScreenAudio: false };
  const hasIncomingMic = presence.hasMic && tile.user.micEnabled;
  const hasIncomingScreenAudio =
    presence.hasScreenAudio && tile.user.screenSharing && tile.user.screenAudioEnabled;

  const sharePresence = tile.sharePresence ?? 1;
  const shareFaded = isScreenShare && !tile.isLocal && sharePresence < 0.98;

  const showAnnotationLayer =
    isScreenShare &&
    (strokes.length > 0 ||
      (annotateDrawing && sharePresence >= 0.4 && !tile.isLocal));

  return (
    <div
      ref={tileRef}
      className={clsx(
        "group relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-violet-400/35 bg-black shadow-[0_24px_64px_-20px_rgba(0,0,0,0.85)] ring-1 ring-violet-400/20 transition-[opacity,filter,border-color] duration-500 ease-out",
        isFullscreen && "flex h-screen w-screen items-center justify-center rounded-none border-0"
      )}
      style={
        shareFaded
          ? {
              opacity: 0.18 + sharePresence * 0.82,
              filter: `saturate(${0.5 + sharePresence * 0.5}) brightness(${0.75 + sharePresence * 0.25})`,
            }
          : undefined
      }
    >
      {showAnnotationLayer && (
        <ScreenAnnotation
          targetId={tile.id}
          strokes={strokes}
          localUserId={localUserId}
          activeColor={annotationColor}
          interactive={annotateDrawing && sharePresence >= 0.4 && !tile.isLocal}
          onStroke={onStroke}
          onClear={onClear}
          onColorChange={onColorChange}
          hideToolbar
          videoRef={mediaRef}
        />
      )}

      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted
        className={clsx(
          "h-full w-full bg-black object-contain transition-transform duration-500",
          !hasVideo && "opacity-0"
        )}
      />

      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(145deg, ${tile.user.color}dd 0%, ${tile.user.color}88 45%, #09090b 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full text-base font-semibold text-white shadow-xl ring-2 ring-white/30"
            style={{ backgroundColor: tile.user.color }}
          >
            {getInitials(tile.user.name)}
          </div>
        </div>
      )}

      <StageOverlay
        presenter={tile.user}
        isLocalPresenter={tile.isLocal}
        viewerCount={viewerCount}
        isScreenShare={isScreenShare}
        hasIncomingMic={hasIncomingMic}
        hasIncomingScreenAudio={hasIncomingScreenAudio}
        micMuted={micMuted}
        screenAudioMuted={screenAudioMuted}
        onToggleAudioMute={onToggleAudioMute}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        annotateDrawing={annotateDrawing}
        canAnnotate={canAnnotate}
        onToggleAnnotate={onToggleAnnotateDrawing}
        proximityHint={proximityHint}
      />

      {!tile.isLocal && tile.connectionState && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[12]">
          <ConnectionBadge state={tile.connectionState} />
        </div>
      )}

      {/* Bottom-docked annotation toolbar — feels native to the stage when drawing is active */}
      {annotateDrawing && canAnnotate && !tile.isLocal && sharePresence >= 0.4 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex justify-center pb-3">
          <AnnotationToolbar
            activeColor={annotationColor}
            onColorChange={onColorChange}
            onClear={() => onClear(tile.id)}
            variant="dock"
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}

function VideoTile({
  tile,
  expanded,
  micMuted,
  screenAudioMuted,
  onToggleAudioMute,
  strokes,
  localUserId,
  annotationColor,
  onStroke,
  onClear,
  onColorChange,
}: {
  tile: TileData;
  expanded: boolean;
  micMuted: boolean;
  screenAudioMuted: boolean;
  onToggleAudioMute?: (kind: "mic" | "screen") => void;
  strokes: DrawStroke[];
  localUserId: string;
  annotationColor: string;
  onStroke: (stroke: DrawStroke) => void;
  onClear: (targetId: string) => void;
  onColorChange: (color: string) => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoTrackId = tile.stream?.getVideoTracks()[0]?.id ?? null;

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.srcObject = tile.stream;
    element.volume = 0;
    if (tile.stream) {
      void element.play().catch(() => {});
    }
  }, [tile.stream, videoTrackId]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const video = mediaRef.current;
      const container = tileRef.current;
      setIsFullscreen(
        document.fullscreenElement === video ||
          document.fullscreenElement === container
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = (event: React.MouseEvent) => {
    event.stopPropagation();
    const video = mediaRef.current;
    const container = tileRef.current;
    if (!video && !container) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    if (video?.requestFullscreen) {
      void video.requestFullscreen().catch(() => {
        if (container) void container.requestFullscreen();
      });
      return;
    }
    if (container) void container.requestFullscreen();
  };

  const hasVideo =
    !!tile.stream &&
    tile.stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

  const isScreenShare = tile.user.screenSharing;
  const presence = !tile.isLocal
    ? getPeerAudioPresence(tile.user, tile.stream)
    : { hasMic: false, hasScreenAudio: false };
  const hasIncomingMic = presence.hasMic && tile.user.micEnabled;
  const hasIncomingScreenAudio =
    presence.hasScreenAudio && tile.user.screenSharing && tile.user.screenAudioEnabled;

  const speaking =
    !micMuted && tile.user.micEnabled && (tile.isLocal || tile.volume > 0.01);
  const distanceMeters = tile.dist !== undefined ? Math.max(1, Math.round(tile.dist / 50)) : null;

  return (
    <div
      ref={tileRef}
      className={clsx(
        "group relative overflow-hidden rounded-2xl border bg-zinc-950/80 transition-all duration-300",
        "hover:border-white/[0.18] hover:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)]",
        isScreenShare
          ? "border-violet-400/50 shadow-[0_0_28px_-6px_rgba(139,92,246,0.5)] ring-2 ring-violet-400/40"
          : speaking
            ? "border-emerald-400/50 shadow-[0_0_32px_-6px_rgba(34,197,94,0.55)] ring-2 ring-emerald-400/40 speak-pulse"
            : "border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        isFullscreen && "flex h-screen w-screen items-center justify-center rounded-none border-0 bg-black"
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/10 to-black/30 opacity-90 transition-opacity duration-300 group-hover:opacity-75" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.45)_100%)]" />

      {isScreenShare && strokes.length > 0 && (
        <ScreenAnnotation
          targetId={tile.id}
          strokes={strokes}
          localUserId={localUserId}
          activeColor={annotationColor}
          interactive={false}
          onStroke={onStroke}
          onClear={onClear}
          onColorChange={onColorChange}
        />
      )}

      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted
        className={clsx(
          "aspect-video w-full transition-transform duration-500 group-hover:scale-[1.03]",
          isScreenShare || isFullscreen ? "object-contain bg-black" : "object-cover",
          !hasVideo && "opacity-0"
        )}
      />

      {!hasVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(145deg, ${tile.user.color}dd 0%, ${tile.user.color}88 45%, #09090b 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-black/25" />
          <div
            className={clsx(
              "relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white shadow-xl ring-2 transition-transform duration-300 group-hover:scale-105",
              speaking ? "ring-emerald-400/60" : "ring-white/30"
            )}
            style={{ backgroundColor: tile.user.color }}
          >
            {getInitials(tile.user.name)}
          </div>
        </div>
      )}

      {isScreenShare && (
        <div className="pointer-events-none absolute left-2 top-2 z-[12] flex items-center gap-1">
          <span className="flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-500/25 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 backdrop-blur-md">
            <Monitor className="h-2.5 w-2.5" />
            screen
          </span>
        </div>
      )}

      {!tile.isLocal && distanceMeters !== null && !isScreenShare && (
        <div className="pointer-events-none absolute left-2 top-2 z-[12]">
          <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-200 backdrop-blur-md">
            {distanceMeters}m
          </span>
        </div>
      )}

      <div className="absolute right-2 top-2 z-[12] flex items-center gap-1">
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
              "flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition hover:bg-black/80",
              micMuted
                ? "border-rose-400/30 bg-rose-500/25 text-rose-100"
                : "border-white/10 bg-black/60 text-white"
            )}
          >
            {micMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
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
              "flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition hover:bg-black/80",
              screenAudioMuted
                ? "border-rose-400/30 bg-rose-500/25 text-rose-100"
                : "border-white/10 bg-black/60 text-white"
            )}
          >
            {screenAudioMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </button>
        )}
        {hasVideo && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white opacity-0 backdrop-blur-md transition hover:bg-black/80 group-hover:opacity-100 focus:opacity-100"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {!tile.isLocal && tile.connectionState && (
          <ConnectionBadge state={tile.connectionState} />
        )}
        {!tile.user.micEnabled && (
          <span className="rounded-full border border-rose-400/20 bg-black/60 p-1 backdrop-blur-md">
            <MicOff className="h-3 w-3 text-rose-300" />
          </span>
        )}
      </div>

      {speaking && (
        <div className="pointer-events-none absolute inset-0 z-[2] rounded-2xl ring-1 ring-inset ring-emerald-400/30" />
      )}

      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2.5 pb-2 pt-6",
          isScreenShare ? "pointer-events-none z-[12]" : "z-[2]"
        )}
      >
        <span className="truncate text-[12px] font-medium text-white drop-shadow-sm">
          {tile.user.name}
          {tile.isLocal && <span className="ml-1 text-indigo-300/90">· you</span>}
        </span>
        {tile.user.micEnabled && (
          <span
            className={clsx(
              "flex shrink-0 items-center rounded-full px-1 py-0.5",
              speaking && "bg-emerald-500/20 ring-1 ring-emerald-400/30"
            )}
          >
            <AudioBars active={speaking} />
          </span>
        )}
        {!tile.isLocal && expanded && tile.user.micEnabled && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-300 backdrop-blur-sm">
            <Volume2 className="h-2.5 w-2.5" />
            {Math.round(tile.volume * 100)}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.06),transparent_70%)]" />
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-emerald-500/15 animate-ping" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 ring-1 ring-emerald-500/30">
          <Radio className="h-4 w-4 text-emerald-400/80" />
        </span>
      </div>
      <p className="relative mt-4 text-[12px] font-medium text-zinc-200">It&apos;s quiet here</p>
      <p className="relative mt-1.5 text-[11px] leading-5 text-zinc-500">
        Walk near a teammate to start a conversation.
      </p>
    </div>
  );
}

function TileSlot({
  tile,
  expanded,
  peerMicMuted,
  peerScreenAudioMuted,
  onTogglePeerAudioMute,
  annotations,
  localUserId,
  annotationColor,
  onAnnotationStroke,
  onAnnotationClear,
  onAnnotationColorChange,
}: {
  tile: TileData;
  expanded: boolean;
  peerMicMuted: ReadonlySet<string>;
  peerScreenAudioMuted: ReadonlySet<string>;
  onTogglePeerAudioMute: (userId: string, kind: "mic" | "screen") => void;
  annotations: Map<string, DrawStroke[]>;
  localUserId: string;
  annotationColor: string;
  onAnnotationStroke: (stroke: DrawStroke) => void;
  onAnnotationClear: (targetId: string) => void;
  onAnnotationColorChange: (color: string) => void;
}) {
  return (
    <VideoTile
      tile={tile}
      expanded={expanded}
      micMuted={peerMicMuted.has(tile.id)}
      screenAudioMuted={peerScreenAudioMuted.has(tile.id)}
      onToggleAudioMute={
        tile.isLocal ? undefined : (kind) => onTogglePeerAudioMute(tile.id, kind)
      }
      strokes={annotations.get(tile.id) ?? []}
      localUserId={localUserId}
      annotationColor={annotationColor}
      onStroke={onAnnotationStroke}
      onClear={onAnnotationClear}
      onColorChange={onAnnotationColorChange}
    />
  );
}

export function VideoGrid({
  localUser,
  localScreenSharing,
  users,
  localStream,
  remoteStreams,
  peerStates,
  peerMicMuted,
  peerScreenAudioMuted,
  onTogglePeerAudioMute,
  annotations,
  localUserId,
  annotationColor,
  onAnnotationColorChange,
  onAnnotationStroke,
  onAnnotationClear,
  annotateDrawing,
  onToggleAnnotateDrawing,
}: VideoGridProps) {
  const [expanded, setExpanded] = useState(false);
  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);

  const localPresenting = localScreenSharing || localUser.screenSharing;

  const callParticipants = useMemo<TileData[]>(() => {
    const remoteUsers = users.filter((user) => user.id !== localUser.id);
    const members: TileData[] = [
      {
        id: localUser.id,
        user: localUser,
        stream: localStream,
        isLocal: true,
        volume: 1,
        sharePresence: localPresenting ? 1 : undefined,
      },
    ];

    for (const user of remoteUsers) {
      const dist = distance(localUser, user);
      if (user.screenSharing) {
        const sharePresence = getScreenSharePresence(dist);
        if (sharePresence <= SCREEN_SHARE_VISIBLE_THRESHOLD) continue;
        members.push({
          id: user.id,
          user,
          stream: remoteStreams.get(user.id) ?? null,
          isLocal: false,
          volume: sharePresence,
          dist,
          sharePresence,
          connectionState: peerStates.get(user.id),
        });
      } else if (dist <= AUDIO_RANGE) {
        members.push({
          id: user.id,
          user,
          stream: remoteStreams.get(user.id) ?? null,
          isLocal: false,
          volume: getAudioVolume(dist),
          dist,
          connectionState: peerStates.get(user.id),
        });
      }
    }

    return members;
  }, [
    localPresenting,
    localStream,
    localUser,
    peerStates,
    remoteStreams,
    users,
  ]);

  const screenSharers = useMemo(
    () => callParticipants.filter((p) => p.user.screenSharing),
    [callParticipants]
  );

  const anyonePresenting = hasNearbyPresenter(
    localUser,
    users,
    localPresenting
  );

  const useStageLayout = anyonePresenting && callParticipants.length > 0;

  const focusedStage = useMemo(() => {
    if (!useStageLayout) return null;
    if (focusedStageId) {
      const found = callParticipants.find((p) => p.id === focusedStageId);
      if (found) return found;
    }
    const fallbackId = pickDefaultStageFocus(callParticipants, localPresenting);
    return callParticipants.find((p) => p.id === fallbackId) ?? callParticipants[0] ?? null;
  }, [callParticipants, focusedStageId, localPresenting, useStageLayout]);

  useEffect(() => {
    if (!useStageLayout) {
      setFocusedStageId(null);
      return;
    }
    if (
      focusedStageId &&
      callParticipants.some((p) => p.id === focusedStageId)
    ) {
      return;
    }
    setFocusedStageId(pickDefaultStageFocus(callParticipants, localPresenting));
  }, [callParticipants, focusedStageId, localPresenting, useStageLayout]);

  useEffect(() => {
    if (!annotateDrawing || !useStageLayout) return;
    const currentFocus = focusedStageId
      ? callParticipants.find((p) => p.id === focusedStageId)
      : null;
    if (currentFocus?.user.screenSharing && !currentFocus.isLocal) return;
    const remoteShare = callParticipants.find(
      (p) => p.user.screenSharing && !p.isLocal
    );
    if (remoteShare && remoteShare.id !== focusedStageId) {
      setFocusedStageId(remoteShare.id);
    }
  }, [annotateDrawing, callParticipants, focusedStageId, useStageLayout]);

  const focusStage = useCallback((id: string) => {
    setFocusedStageId(id);
  }, []);

  const nearbyCameraTiles = useMemo(
    () => callParticipants.filter((p) => !p.user.screenSharing),
    [callParticipants]
  );

  const tiles = callParticipants;
  const remoteTiles = nearbyCameraTiles.filter((p) => !p.isLocal);
  const hasNearby = remoteTiles.length > 0 || localPresenting;
  const useGrid = !useStageLayout && tiles.length >= 3;
  const nearbySpeaking = remoteTiles.some(
    (p) => p.user.micEnabled && p.volume > 0.01
  );
  const anyoneSpeaking = nearbySpeaking || (hasNearby && localUser.micEnabled);

  const slotProps = {
    expanded,
    peerMicMuted,
    peerScreenAudioMuted,
    onTogglePeerAudioMute,
    annotations,
    localUserId,
    annotationColor,
    onAnnotationStroke,
    onAnnotationClear,
    onAnnotationColorChange,
  };

  if (useStageLayout && focusedStage) {
    const presenterTile = focusedStage;
    const canAnnotateStage =
      presenterTile.user.screenSharing && !presenterTile.isLocal;
    const proximityHint = (() => {
      if (!presenterTile.user.screenSharing) return null;
      if (presenterTile.isLocal) {
        return annotateDrawing
          ? "Toggle off the pencil to draw on a teammate"
          : null;
      }
      if (
        presenterTile.sharePresence !== undefined &&
        presenterTile.sharePresence < 0.4
      ) {
        return annotateDrawing
          ? "Step closer to start drawing"
          : "Walk closer for a clearer view";
      }
      if (annotateDrawing) {
        return `Marking up ${presenterTile.user.name}'s screen`;
      }
      if (
        presenterTile.sharePresence !== undefined &&
        presenterTile.sharePresence < 0.85
      ) {
        return "Walk closer for a clearer view";
      }
      return null;
    })();

    // Viewer count = everyone in the call except the presenter themselves
    const viewerCount = callParticipants.filter((p) => p.id !== presenterTile.id).length;

    const stripItems: ParticipantStripItem[] = callParticipants.map((p) => ({
      id: p.id,
      user: p.user,
      stream: p.stream,
      isLocal: p.isLocal,
      volume: p.volume,
      isPresenter: p.user.screenSharing,
      audioMuted: peerMicMuted.has(p.id),
    }));

    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Multi-presenter chip row — only when >1 person sharing */}
        {screenSharers.length > 1 && (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.05] px-3 py-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Sharing:
            </span>
            {screenSharers.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => focusStage(tile.id)}
                className={clsx(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  tile.id === presenterTile.id
                    ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                {tile.user.name}
                {tile.isLocal && " · you"}
              </button>
            ))}
          </div>
        )}

        {/* Hero stage */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
          <div className="relative min-h-0 flex-1">
            <StageTile
              tile={presenterTile}
              micMuted={peerMicMuted.has(presenterTile.id)}
              screenAudioMuted={peerScreenAudioMuted.has(presenterTile.id)}
              onToggleAudioMute={
                presenterTile.isLocal
                  ? undefined
                  : (kind) => onTogglePeerAudioMute(presenterTile.id, kind)
              }
              strokes={annotations.get(presenterTile.id) ?? []}
              localUserId={localUserId}
              annotationColor={annotationColor}
              onStroke={onAnnotationStroke}
              onClear={onAnnotationClear}
              onColorChange={onAnnotationColorChange}
              annotateDrawing={annotateDrawing}
              canAnnotate={canAnnotateStage}
              onToggleAnnotateDrawing={onToggleAnnotateDrawing}
              viewerCount={viewerCount}
              proximityHint={proximityHint}
            />
          </div>

          {/* Clean participant strip */}
          <div className="shrink-0">
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                In call
              </p>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                {callParticipants.length}
              </span>
            </div>
            <ParticipantStrip
              items={stripItems}
              focusedId={presenterTile.id}
              onSelect={focusStage}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-2">
      <div className="flex shrink-0 items-center justify-between gap-3 px-2 pb-3 pt-1">
        <div className="flex min-w-0 items-center gap-2">
          {anyoneSpeaking && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
          <Camera className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-white">Nearby</h3>
          <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
            {remoteTiles.length}
          </span>
        </div>

        {hasNearby && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            {expanded ? "hide details" : "show details"}
          </button>
        )}
      </div>

      <div
        className={clsx(
          "flex-1 overflow-y-auto px-2 pb-3",
          useGrid ? "grid grid-cols-2 gap-2" : "space-y-2"
        )}
      >
        {tiles.map((tile) => (
          <TileSlot key={tile.id} tile={tile} {...slotProps} />
        ))}

        {!hasNearby && <EmptyState />}
      </div>
    </div>
  );
}
