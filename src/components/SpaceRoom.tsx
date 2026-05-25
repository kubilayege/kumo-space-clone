"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Copy, Users, X } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { ControlBar } from "@/components/ControlBar";
import { OfficeCanvas } from "@/components/OfficeCanvas";
import { VideoGrid } from "@/components/VideoGrid";
import { disconnectSocket, getSocket, joinSpace } from "@/lib/socket";
import {
  ChatMessage,
  DEFAULT_OFFICE,
  MOVE_SPEED,
  User,
  UserStatus,
  clampPosition,
  getZoneAt,
} from "@/lib/types";
import { ConnectionState, WebRTCManager } from "@/lib/webrtc";

interface SpaceRoomProps {
  spaceId: string;
}

export function SpaceRoom({ spaceId }: SpaceRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Guest";
  const color = searchParams.get("color") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, ConnectionState>>(new Map());
  const [copied, setCopied] = useState(false);

  const keysPressed = useRef(new Set<string>());
  const positionRef = useRef({ x: 600, y: 440 });
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const animationRef = useRef<number | null>(null);

  const peerIds = useMemo(() => {
    if (!localUser) return [];
    return users.filter((user) => user.id !== localUser.id).map((user) => user.id);
  }, [localUser, users]);

  const currentZone = useMemo(() => {
    if (!localUser) return null;
    return getZoneAt(localUser.x, localUser.y, DEFAULT_OFFICE);
  }, [localUser]);

  useEffect(() => {
    webrtcRef.current = new WebRTCManager(
      (peerId, stream) => {
        setRemoteStreams((current) => {
          const next = new Map(current);
          if (stream) next.set(peerId, stream);
          else next.delete(peerId);
          return next;
        });
      },
      (peerId, state) => {
        setPeerStates((current) => {
          const next = new Map(current);
          if (state === "failed") next.delete(peerId);
          else next.set(peerId, state);
          return next;
        });
      }
    );

    return () => {
      webrtcRef.current?.destroy();
      webrtcRef.current = null;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    joinSpace(spaceId, name, color)
      .then(({ user, users: initialUsers, messages: initialMessages }) => {
        if (!mounted) return;
        positionRef.current = { x: user.x, y: user.y };
        setLocalUser(user);
        setUsers(initialUsers);
        setMessages(initialMessages);
        setLoading(false);
      })
      .catch((joinError) => {
        if (!mounted) return;
        setError(joinError instanceof Error ? joinError.message : "Failed to join space");
        setLoading(false);
      });

    const socket = getSocket();

    socket.on("users:update", (updatedUsers: User[]) => {
      setUsers(updatedUsers);
    });

    socket.on("user:moved", (payload: { id: string; x: number; y: number }) => {
      setUsers((current) =>
        current.map((user) =>
          user.id === payload.id ? { ...user, x: payload.x, y: payload.y } : user
        )
      );
    });

    socket.on("user:updated", (user: User) => {
      setUsers((current) => current.map((entry) => (entry.id === user.id ? user : entry)));
      if (user.id === socket.id) {
        setLocalUser(user);
      }
    });

    socket.on("user:left", (userId: string) => {
      setUsers((current) => current.filter((user) => user.id !== userId));
      webrtcRef.current?.removePeer(userId);
    });

    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((current) => [...current, message]);
    });

    return () => {
      mounted = false;
      socket.off("users:update");
      socket.off("user:moved");
      socket.off("user:updated");
      socket.off("user:left");
      socket.off("chat:message");
      disconnectSocket();
    };
  }, [spaceId, name, color]);

  useEffect(() => {
    const socketId = getSocket().id;
    if (socketId && localUser) {
      webrtcRef.current?.syncPeers(peerIds, socketId);
    }
  }, [peerIds, localUser]);

  useEffect(() => {
    const resumeAudio = () => {
      document.querySelectorAll("video").forEach((element) => {
        void element.play().catch(() => {});
      });
    };

    window.addEventListener("pointerdown", resumeAudio);
    window.addEventListener("keydown", resumeAudio);

    return () => {
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
    };
  }, []);

  const emitMove = useCallback((x: number, y: number) => {
    positionRef.current = { x, y };
    setLocalUser((current) => (current ? { ...current, x, y } : current));
    setUsers((current) =>
      current.map((user) => (user.id === getSocket().id ? { ...user, x, y } : user))
    );
    getSocket().emit("user:move", { x, y });
  }, []);

  const moveBy = useCallback(
    (dx: number, dy: number) => {
      const next = clampPosition(positionRef.current.x + dx, positionRef.current.y + dy, {
        width: 1200,
        height: 800,
        zones: [],
      });
      emitMove(next.x, next.y);
    },
    [emitMove]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      keysPressed.current.add(event.key.toLowerCase());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const tick = () => {
      let dx = 0;
      let dy = 0;

      if (keysPressed.current.has("arrowup") || keysPressed.current.has("w")) dy -= MOVE_SPEED;
      if (keysPressed.current.has("arrowdown") || keysPressed.current.has("s")) dy += MOVE_SPEED;
      if (keysPressed.current.has("arrowleft") || keysPressed.current.has("a")) dx -= MOVE_SPEED;
      if (keysPressed.current.has("arrowright") || keysPressed.current.has("d")) dx += MOVE_SPEED;

      if (dx !== 0 || dy !== 0) moveBy(dx, dy);

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [moveBy]);

  const updateMedia = async (nextMic: boolean, nextCamera: boolean) => {
    setMicEnabled(nextMic);
    setCameraEnabled(nextCamera);

    let stream = localStream;

    if (nextMic || nextCamera) {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: nextMic,
          video: nextCamera,
        });
      } else {
        if (nextMic && !stream.getAudioTracks().length) {
          const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
          audio.getAudioTracks().forEach((track) => stream?.addTrack(track));
        }
        if (nextCamera && !stream.getVideoTracks().length) {
          const video = await navigator.mediaDevices.getUserMedia({ video: true });
          video.getVideoTracks().forEach((track) => stream?.addTrack(track));
        }
      }

      stream.getAudioTracks().forEach((track) => {
        track.enabled = nextMic;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = nextCamera;
      });
    } else if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    setLocalStream(stream);
    await webrtcRef.current?.setLocalStream(stream);

    const socketId = getSocket().id;
    if (socketId) {
      await webrtcRef.current?.syncPeers(peerIds, socketId);
    }

    getSocket().emit("user:media", {
      micEnabled: nextMic,
      cameraEnabled: nextCamera,
    });
  };

  const handleStatusChange = (status: UserStatus) => {
    getSocket().emit("user:status", status);
    setLocalUser((current) => (current ? { ...current, status } : current));
  };

  const handleSendMessage = (text: string, scope: "nearby" | "floor" | "all") => {
    getSocket().emit("chat:send", { text, scope });
  };

  const handleLeave = () => {
    disconnectSocket();
    router.push("/");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingState />;

  if (error || !localUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#07070d] px-6 text-center">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 px-6 py-5">
          <p className="text-sm text-rose-300">{error ?? "Unable to join space"}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/30"
        >
          Back home
        </button>
      </div>
    );
  }

  const onlineCount = users.length;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07070d]">
      <div className="flex h-full">
        {/* Office canvas area */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Top-left floating header */}
          <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-black/55 px-3 py-2 backdrop-blur-xl">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
                <span className="text-[11px] font-bold text-white">K</span>
              </div>
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-[12px] font-semibold text-white">
                  {spaceId}
                </p>
                <p className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <Users className="h-2.5 w-2.5" />
                  {onlineCount} online
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                title="Copy space link"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {copied && (
                <span className="text-[10px] font-medium text-emerald-300">copied!</span>
              )}
            </div>
          </div>

          {/* Online users floating chip */}
          <OnlineUsersChip users={users} localUserId={localUser.id} />

          {/* Office canvas */}
          <div className="absolute inset-0 p-4">
            <OfficeCanvas users={users} localUser={localUser} onMove={emitMove} />
          </div>

          {/* Floating control dock */}
          <ControlBar
            localUser={localUser}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            sidebarOpen={sidebarOpen}
            onToggleMic={() => updateMedia(!micEnabled, cameraEnabled)}
            onToggleCamera={() => updateMedia(micEnabled, !cameraEnabled)}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            onStatusChange={handleStatusChange}
            onLeave={handleLeave}
          />
        </div>

        {/* Sidebar */}
        <aside
          className={clsx(
            "z-40 flex h-full shrink-0 flex-col border-l border-white/[0.06] bg-[#0a0a14]/95 backdrop-blur-xl transition-all duration-300 ease-out",
            "fixed inset-y-0 right-0 lg:static",
            sidebarOpen ? "w-[340px] translate-x-0" : "w-0 translate-x-full lg:translate-x-0"
          )}
        >
          {sidebarOpen && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.05] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Floor activity
                </p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nearby videos (top) */}
              <div className="flex max-h-[55%] shrink-0 flex-col overflow-hidden border-b border-white/[0.05] pt-3">
                <VideoGrid
                  localUser={localUser}
                  users={users}
                  localStream={localStream}
                  remoteStreams={remoteStreams}
                  peerStates={peerStates}
                />
              </div>

              {/* Chat (bottom, flex-grow) */}
              <div className="flex min-h-0 flex-1 flex-col pt-3">
                <ChatPanel
                  messages={messages}
                  onSend={handleSendMessage}
                  currentUserId={localUser.id}
                  currentZone={currentZone}
                />
              </div>
            </div>
          )}
        </aside>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function OnlineUsersChip({ users, localUserId }: { users: User[]; localUserId: string }) {
  const others = users.filter((u) => u.id !== localUserId).slice(0, 5);

  if (others.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 hidden md:block">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/55 px-3 py-2 backdrop-blur-xl">
        <div className="flex -space-x-2">
          {others.map((user) => (
            <div
              key={user.id}
              title={user.name}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[#07070d]"
              style={{ backgroundColor: user.color }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
        {users.length - 1 > others.length && (
          <span className="text-[11px] font-medium text-zinc-400">
            +{users.length - 1 - others.length}
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#07070d]">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute left-1/3 top-1/3 h-[420px] w-[420px] bg-indigo-600/15 blur-3xl" />
      </div>
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/40">
          <span className="text-xl font-bold text-white">K</span>
          <span className="absolute -inset-1 rounded-2xl ring-2 ring-indigo-400/40 speak-pulse" />
        </div>
        <p className="text-[13px] text-zinc-400">Stepping into the office…</p>
      </div>
    </div>
  );
}
