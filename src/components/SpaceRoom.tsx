"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { ControlBar } from "@/components/ControlBar";
import { OfficeCanvas } from "@/components/OfficeCanvas";
import { VideoGrid } from "@/components/VideoGrid";
import { disconnectSocket, getSocket, joinSpace } from "@/lib/socket";
import {
  AUDIO_RANGE,
  ChatMessage,
  MOVE_SPEED,
  User,
  UserStatus,
  clampPosition,
  distance,
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
  const [chatOpen, setChatOpen] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, ConnectionState>>(new Map());

  const keysPressed = useRef(new Set<string>());
  const positionRef = useRef({ x: 600, y: 440 });
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const animationRef = useRef<number | null>(null);

  const nearbyPeerIds = useMemo(() => {
    if (!localUser) return [];
    return users
      .filter((user) => user.id !== localUser.id && distance(localUser, user) <= AUDIO_RANGE)
      .map((user) => user.id);
  }, [localUser, users]);

  useEffect(() => {
    webrtcRef.current = new WebRTCManager(
      (peerId, stream) => {
        setRemoteStreams((current) => {
          const next = new Map(current);
          if (stream) {
            next.set(peerId, stream);
          } else {
            next.delete(peerId);
          }
          return next;
        });
      },
      (peerId, state) => {
        setPeerStates((current) => {
          const next = new Map(current);
          if (state === "failed") {
            next.delete(peerId);
          } else {
            next.set(peerId, state);
          }
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
      webrtcRef.current?.syncPeers(nearbyPeerIds, socketId);
    }
  }, [nearbyPeerIds, localUser]);

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
      const next = clampPosition(
        positionRef.current.x + dx,
        positionRef.current.y + dy,
        { width: 1200, height: 800, zones: [] }
      );
      emitMove(next.x, next.y);
    },
    [emitMove]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

      if (
        keysPressed.current.has("arrowup") ||
        keysPressed.current.has("w")
      ) {
        dy -= MOVE_SPEED;
      }
      if (
        keysPressed.current.has("arrowdown") ||
        keysPressed.current.has("s")
      ) {
        dy += MOVE_SPEED;
      }
      if (
        keysPressed.current.has("arrowleft") ||
        keysPressed.current.has("a")
      ) {
        dx -= MOVE_SPEED;
      }
      if (
        keysPressed.current.has("arrowright") ||
        keysPressed.current.has("d")
      ) {
        dx += MOVE_SPEED;
      }

      if (dx !== 0 || dy !== 0) {
        moveBy(dx, dy);
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
      await webrtcRef.current?.syncPeers(nearbyPeerIds, socketId);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f14] text-zinc-300">
        Joining space...
      </div>
    );
  }

  if (error || !localUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f14] px-6 text-center">
        <p className="text-lg text-rose-300">{error ?? "Unable to join space"}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-400"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0f0f14]">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm text-indigo-200/80">Now in space</p>
                <h1 className="text-2xl font-semibold text-white">{spaceId}</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Use WASD or arrow keys to move. Click anywhere on the floor to walk there.
                </p>
              </div>
              <div className="max-w-xl flex-1">
                <VideoGrid
                  localUser={localUser}
                  users={users}
                  localStream={localStream}
                  remoteStreams={remoteStreams}
                  peerStates={peerStates}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-4">
            <OfficeCanvas users={users} localUser={localUser} onMove={emitMove} />
          </div>
        </div>

        <div className="hidden w-[360px] shrink-0 lg:block">
          <ChatPanel
            messages={messages}
            onSend={handleSendMessage}
            currentUserId={localUser.id}
          />
        </div>
      </div>

      {chatOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setChatOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[#14141b]/95 backdrop-blur">
            <ChatPanel
              messages={messages}
              onSend={handleSendMessage}
              currentUserId={localUser.id}
            />
          </div>
        </div>
      )}

      <ControlBar
        localUser={localUser}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        sidebarOpen={chatOpen}
        onToggleMic={() => updateMedia(!micEnabled, cameraEnabled)}
        onToggleCamera={() => updateMedia(micEnabled, !cameraEnabled)}
        onToggleSidebar={() => setChatOpen((value) => !value)}
        onStatusChange={handleStatusChange}
        onLeave={handleLeave}
      />
    </div>
  );
}
