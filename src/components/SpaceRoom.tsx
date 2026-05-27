"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Copy, Monitor, MonitorOff, Pencil, PhoneOff, UserPlus, Users, X } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { ControlBar } from "@/components/ControlBar";
import { InviteModal } from "@/components/InviteModal";
import { OfficeCanvas } from "@/components/OfficeCanvas";
import { SpaceEditor } from "@/components/SpaceEditor";
import { SpatialAudio } from "@/components/SpatialAudio";
import { BroadcastPreview } from "@/components/BroadcastPreview";
import { ResizableSidebar } from "@/components/ResizableSidebar";
import { VideoGrid } from "@/components/VideoGrid";
import { disconnectSocket, getSocket, joinSpace } from "@/lib/socket";
import {
  ChatMessage,
  DEFAULT_OFFICE,
  MOVE_SPEED,
  OfficeMap,
  TypingEvent,
  TypingStopEvent,
  TypingUser,
  User,
  UserStatus,
  clampPosition,
  getZoneAt,
  hasNearbyPresenter,
  shouldConnectPeer,
} from "@/lib/types";
import {
  ScreenShareSurface,
  captureDisplay,
  clearVideoTracks,
  setStreamAudioTracks,
  swapVideoTrack,
  tagMicTrack,
  tagScreenAudioTrack,
} from "@/lib/screenShare";
import {
  ANNOTATION_COLORS,
  DrawStroke,
  strokesToMap,
} from "@/lib/annotations";
import {
  ScreenShareQualityId,
  applyScreenTrackConstraints,
  getScreenShareQualityPreset,
  loadScreenShareQuality,
  saveScreenShareQuality,
} from "@/lib/screenShareQuality";
import { liveTrack, stopMediaStream, stopMediaTrack } from "@/lib/mediaSession";
import { ConnectionState, WebRTCManager } from "@/lib/webrtc";

interface SpaceRoomProps {
  spaceId: string;
}

export function SpaceRoom({ spaceId }: SpaceRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Guest";
  const color = searchParams.get("color") ?? undefined;
  const spawnX = Number(searchParams.get("x"));
  const spawnY = Number(searchParams.get("y"));
  const spawn =
    Number.isFinite(spawnX) && Number.isFinite(spawnY) && (spawnX || spawnY)
      ? { x: spawnX, y: spawnY }
      : undefined;
  const wantMic = searchParams.get("mic") === "1";
  const wantCam = searchParams.get("cam") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareQuality, setScreenShareQuality] =
    useState<ScreenShareQualityId>("balanced");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, ConnectionState>>(new Map());
  const [copied, setCopied] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [peerMicMuted, setPeerMicMuted] = useState<Set<string>>(() => new Set());
  const [peerScreenAudioMuted, setPeerScreenAudioMuted] = useState<Set<string>>(
    () => new Set()
  );
  const [annotations, setAnnotations] = useState<Map<string, DrawStroke[]>>(new Map());
  const [annotationColor, setAnnotationColor] = useState(ANNOTATION_COLORS[0]);
  const [annotateDrawing, setAnnotateDrawing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [broadcastPreviewOpen, setBroadcastPreviewOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [officeMap, setOfficeMap] = useState<OfficeMap>(DEFAULT_OFFICE);

  const keysPressed = useRef(new Set<string>());
  const positionRef = useRef({ x: 600, y: 440 });
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const displayAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenSharingRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenSharingRef.current = screenSharing;
  }, [screenSharing]);

  useEffect(() => {
    if (screenSharing) {
      setAnnotateDrawing(false);
    }
  }, [screenSharing]);

  useEffect(() => {
    setScreenShareQuality(loadScreenShareQuality());
  }, []);

  const applyScreenEncoding = useCallback(async (qualityId: ScreenShareQualityId) => {
    const preset = getScreenShareQualityPreset(qualityId);
    await webrtcRef.current?.setScreenShareEncoding({
      maxBitrate: preset.maxBitrate,
      maxFramerate: preset.maxFramerate,
    });
  }, []);

  const handleScreenShareQualityChange = useCallback(
    async (qualityId: ScreenShareQualityId) => {
      setScreenShareQuality(qualityId);
      saveScreenShareQuality(qualityId);

      if (!screenSharing) return;

      const preset = getScreenShareQualityPreset(qualityId);
      if (screenTrackRef.current) {
        try {
          await applyScreenTrackConstraints(screenTrackRef.current, preset);
        } catch {
          // browser may reject live constraint changes
        }
      }
      await applyScreenEncoding(qualityId);
    },
    [applyScreenEncoding, screenSharing]
  );

  const emitAnnotationStroke = useCallback((stroke: DrawStroke) => {
    getSocket().emit("annotate:stroke", stroke);
    setAnnotations((current) => {
      const next = new Map(current);
      const list = [...(next.get(stroke.targetId) ?? []), stroke];
      next.set(stroke.targetId, list);
      return next;
    });
  }, []);

  const emitAnnotationClear = useCallback((targetId: string) => {
    getSocket().emit("annotate:clear", { targetId });
    setAnnotations((current) => {
      const next = new Map(current);
      next.delete(targetId);
      return next;
    });
  }, []);

  const togglePeerAudioMute = useCallback(
    (userId: string, kind: "mic" | "screen") => {
      const setState = kind === "mic" ? setPeerMicMuted : setPeerScreenAudioMuted;
      setState((current) => {
        const next = new Set(current);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return next;
      });
    },
    []
  );

  // Push the mic + screen-audio tracks onto `stream` as separate tracks (no
  // mixing). Both are tagged via contentHint so the receiver can route them
  // independently. If a track shouldn't be sent (mic off, no display audio),
  // it's simply omitted.
  const applyShareAudio = useCallback(
    (stream: MediaStream, displayStream: MediaStream, withMic: boolean) => {
      const micTrack = micTrackRef.current;
      if (micTrack) {
        micTrack.enabled = withMic;
        tagMicTrack(micTrack);
      }

      const displayAudio = displayStream.getAudioTracks()[0] ?? null;
      if (displayAudio) tagScreenAudioTrack(displayAudio);
      displayAudioTrackRef.current = displayAudio;

      const nextTracks: MediaStreamTrack[] = [];
      if (micTrack && withMic && micTrack.readyState === "live") {
        nextTracks.push(micTrack);
      }
      if (displayAudio && displayAudio.readyState === "live") {
        nextTracks.push(displayAudio);
      }

      setStreamAudioTracks(stream, nextTracks);
    },
    []
  );

  const peerIds = useMemo(() => {
    if (!localUser) return [];
    return users
      .filter((user) => shouldConnectPeer(localUser, user))
      .map((user) => user.id);
  }, [localUser, users]);

  const anyonePresenting = useMemo(() => {
    if (!localUser) return screenSharing;
    return hasNearbyPresenter(localUser, users, screenSharing);
  }, [localUser, users, screenSharing]);

  const activePresenter = useMemo<User | null>(() => {
    if (!localUser) return null;
    if (screenSharing) return localUser;
    return (
      users.find((user) => user.id !== localUser.id && user.screenSharing) ?? null
    );
  }, [localUser, screenSharing, users]);

  const watcherCount = useMemo(() => {
    if (!activePresenter) return 0;
    return users.filter((u) => u.id !== activePresenter.id).length;
  }, [activePresenter, users]);

  useEffect(() => {
    if (!anyonePresenting) {
      setAnnotateDrawing(false);
    }
  }, [anyonePresenting]);

  useEffect(() => {
    if (anyonePresenting) {
      setSidebarOpen(true);
    }
  }, [anyonePresenting]);

  const myStrokes = useMemo(
    () => (localUser ? (annotations.get(localUser.id) ?? []) : []),
    [annotations, localUser]
  );
  const prevMyStrokeCountRef = useRef(0);
  useEffect(() => {
    const count = myStrokes.length;
    if (!screenSharing) {
      prevMyStrokeCountRef.current = count;
      return;
    }
    if (count > prevMyStrokeCountRef.current) {
      setBroadcastPreviewOpen(true);
    }
    prevMyStrokeCountRef.current = count;
  }, [myStrokes, screenSharing]);

  const currentZone = useMemo(() => {
    if (!localUser) return null;
    return getZoneAt(localUser.x, localUser.y, officeMap);
  }, [localUser, officeMap]);

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

    joinSpace(spaceId, name, color, spawn)
      .then(({ user, users: initialUsers, messages: initialMessages, annotations: initialAnnotations, map }) => {
        if (!mounted) return;
        positionRef.current = { x: user.x, y: user.y };
        setLocalUser(user);
        setScreenSharing(user.screenSharing ?? false);
        setUsers(initialUsers);
        setMessages(initialMessages);
        setAnnotations(strokesToMap(initialAnnotations ?? []));
        if (map) setOfficeMap(map);
        setLoading(false);
      })
      .catch((joinError) => {
        if (!mounted) return;
        setError(joinError instanceof Error ? joinError.message : "Failed to join space");
        setLoading(false);
      });

    const socket = getSocket();

    socket.on("users:update", (updatedUsers: User[]) => {
      const selfId = getSocket().id;
      const keepSharing =
        screenSharingRef.current && liveTrack(screenTrackRef.current);
      if (!selfId || !keepSharing) {
        setUsers(updatedUsers);
        return;
      }
      setUsers(
        updatedUsers.map((user) =>
          user.id === selfId ? { ...user, screenSharing: true } : user
        )
      );
    });

    socket.on("user:moved", (payload: { id: string; x: number; y: number }) => {
      setUsers((current) =>
        current.map((user) =>
          user.id === payload.id ? { ...user, x: payload.x, y: payload.y } : user
        )
      );
    });

    socket.on("user:updated", (user: User) => {
      const keepSharing =
        user.id === socket.id &&
        screenSharingRef.current &&
        liveTrack(screenTrackRef.current);
      const merged =
        keepSharing && !user.screenSharing ? { ...user, screenSharing: true } : user;

      setUsers((current) =>
        current.map((entry) => (entry.id === merged.id ? merged : entry))
      );
      if (user.id === socket.id) {
        setLocalUser(merged);
        setScreenSharing(merged.screenSharing ?? false);
      }
    });

    socket.on("user:left", (userId: string) => {
      setUsers((current) => current.filter((user) => user.id !== userId));
      webrtcRef.current?.removePeer(userId);
      setAnnotations((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
      setTypingUsers((current) => {
        if (!current.has(userId)) return current;
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
    });

    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((current) => [...current, message]);
    });

    socket.on("chat:typing", (event: TypingEvent) => {
      setTypingUsers((current) => {
        const next = new Map(current);
        next.set(event.userId, {
          userId: event.userId,
          userName: event.userName,
          userColor: event.userColor,
          scope: event.scope,
          expiresAt: Date.now() + 5000,
        });
        return next;
      });
    });

    socket.on("chat:typing:stop", (event: TypingStopEvent) => {
      setTypingUsers((current) => {
        if (!current.has(event.userId)) return current;
        const next = new Map(current);
        next.delete(event.userId);
        return next;
      });
    });

    socket.on("annotate:stroke", (stroke: DrawStroke) => {
      setAnnotations((current) => {
        const next = new Map(current);
        const list = next.get(stroke.targetId) ?? [];
        if (list.some((entry) => entry.id === stroke.id)) return current;
        next.set(stroke.targetId, [...list, stroke]);
        return next;
      });
    });

    socket.on("annotate:clear", (payload: { targetId: string }) => {
      setAnnotations((current) => {
        const next = new Map(current);
        next.delete(payload.targetId);
        return next;
      });
    });

    socket.on("space:map", (map: OfficeMap) => {
      setOfficeMap(map);
    });

    return () => {
      mounted = false;
      socket.off("space:map");
      socket.off("users:update");
      socket.off("user:moved");
      socket.off("user:updated");
      socket.off("user:left");
      socket.off("chat:message");
      socket.off("chat:typing");
      socket.off("chat:typing:stop");
      socket.off("annotate:stroke");
      socket.off("annotate:clear");
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, name, color]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTypingUsers((current) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(current);
        for (const [id, entry] of current) {
          if (entry.expiresAt <= now) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const socketId = getSocket().id;
    if (socketId && localUser) {
      webrtcRef.current?.syncPeers(peerIds, socketId);
    }
  }, [peerIds, localUser]);

  const resumeMediaPlayback = useCallback(() => {
    document.querySelectorAll("video, audio").forEach((element) => {
      void (element as HTMLMediaElement).play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", resumeMediaPlayback);
    window.addEventListener("keydown", resumeMediaPlayback);

    return () => {
      window.removeEventListener("pointerdown", resumeMediaPlayback);
      window.removeEventListener("keydown", resumeMediaPlayback);
    };
  }, [resumeMediaPlayback]);

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
        officeMap
      );
      emitMove(next.x, next.y);
    },
    [emitMove, officeMap]
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

  const publishStream = useCallback(
    async (stream: MediaStream | null) => {
      const next = stream ? new MediaStream(stream.getTracks()) : null;
      setLocalStream(next);
      await webrtcRef.current?.setLocalStream(stream);
      const socketId = getSocket().id;
      if (socketId) {
        await webrtcRef.current?.syncPeers(peerIds, socketId);
      }
      resumeMediaPlayback();
    },
    [peerIds, resumeMediaPlayback]
  );

  const broadcastMedia = useCallback(
    (mic: boolean, cam: boolean, screen: boolean, screenAudio: boolean) => {
      getSocket().emit("user:media", {
        micEnabled: mic,
        cameraEnabled: cam,
        screenSharing: screen,
        screenAudioEnabled: screenAudio,
      });
      setLocalUser((current) =>
        current
          ? {
              ...current,
              micEnabled: mic,
              cameraEnabled: cam,
              screenSharing: screen,
              screenAudioEnabled: screenAudio,
            }
          : current
      );
    },
    []
  );

  const acquireMicTrack = useCallback(async (): Promise<MediaStreamTrack | null> => {
    const existing = liveTrack(micTrackRef.current);
    if (existing) {
      existing.enabled = true;
      tagMicTrack(existing);
      return existing;
    }

    stopMediaTrack(micTrackRef.current);
    micTrackRef.current = null;

    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = audioStream.getAudioTracks()[0] ?? null;
    if (track) {
      tagMicTrack(track);
      micTrackRef.current = track;
    }
    return track;
  }, []);

  const releaseShareTracks = useCallback(() => {
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current = null;
    }
    if (displayAudioTrackRef.current) {
      displayAudioTrackRef.current.onended = null;
      displayAudioTrackRef.current = null;
    }
    if (displayStreamRef.current) {
      stopMediaStream(displayStreamRef.current);
      displayStreamRef.current = null;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!screenSharingRef.current && !screenTrackRef.current) return;
    screenSharingRef.current = false;
    releaseShareTracks();

    const micOn = micEnabled;
    const camOn = cameraEnabled;

    let stream = localStream;
    if (!stream) {
      stream = new MediaStream();
    }

    // Drop all audio tracks; we'll re-add only the mic if needed.
    setStreamAudioTracks(stream, []);
    clearVideoTracks(stream);

    const liveMic = liveTrack(micTrackRef.current);
    if (!liveMic) {
      stopMediaTrack(micTrackRef.current);
      micTrackRef.current = null;
    }

    try {
      if (micOn) {
        const track = liveMic ?? (await acquireMicTrack());
        if (track) {
          tagMicTrack(track);
          track.enabled = true;
          setStreamAudioTracks(stream, [track]);
        }
      }

      if (camOn) {
        const liveVideo = stream
          .getVideoTracks()
          .find((track) => track.readyState === "live" && track.enabled);
        if (!liveVideo) {
          clearVideoTracks(stream);
          const video = await navigator.mediaDevices.getUserMedia({ video: true });
          video.getVideoTracks().forEach((track) => stream.addTrack(track));
        }
      }

      await webrtcRef.current?.setScreenShareEncoding(null);

      const selfId = getSocket().id;
      if (selfId) {
        getSocket().emit("annotate:clear", { targetId: selfId });
        setAnnotations((current) => {
          const next = new Map(current);
          next.delete(selfId);
          return next;
        });
      }

      const hasTracks = stream.getTracks().length > 0;
      await publishStream(hasTracks ? stream : null);
      broadcastMedia(micOn, camOn, false, false);
      setScreenSharing(false);
      resumeMediaPlayback();
    } catch (err) {
      setScreenSharing(false);
      setMediaError(
        err instanceof Error ? err.message : "Could not restore microphone after screen share"
      );
    }
  }, [
    acquireMicTrack,
    broadcastMedia,
    cameraEnabled,
    localStream,
    micEnabled,
    publishStream,
    releaseShareTracks,
    resumeMediaPlayback,
  ]);

  const startScreenShare = useCallback(
    async (surface?: ScreenShareSurface) => {
      try {
        const preset = getScreenShareQualityPreset(screenShareQuality);
        const displayStream = await captureDisplay(surface, preset);
        const screenTrack = displayStream.getVideoTracks()[0];
        if (!screenTrack || screenTrack.readyState !== "live") return;

        if (displayStreamRef.current) {
          stopMediaStream(displayStreamRef.current);
        }
        displayStreamRef.current = displayStream;

        let stream = localStream;
        if (!stream) {
          stream = new MediaStream();
        }

        // Ensure we have a mic track for the broadcaster if mic is enabled,
        // and tag it as speech so receivers can route it correctly.
        if (micEnabled) {
          await acquireMicTrack();
        }

        screenTrackRef.current = screenTrack;
        swapVideoTrack(stream, screenTrack);

        const trackId = screenTrack.id;
        screenTrack.onended = () => {
          if (screenTrackRef.current?.id !== trackId) return;
          screenSharingRef.current = false;
          void stopScreenShare();
        };

        const displayAudio = displayStream.getAudioTracks()[0];
        if (displayAudio) {
          displayAudio.onended = () => {
            if (displayAudioTrackRef.current?.id !== displayAudio.id) return;
            displayAudioTrackRef.current = null;
            const current = localStreamRef.current;
            if (!current || !screenSharingRef.current) return;
            applyShareAudio(current, new MediaStream(), micEnabled);
            broadcastMedia(micEnabled, cameraEnabled, true, false);
            void publishStream(current);
          };
        }

        applyShareAudio(stream, displayStream, micEnabled);

        if (screenTrack.readyState !== "live") {
          releaseShareTracks();
          return;
        }

        broadcastMedia(micEnabled, cameraEnabled, true, !!displayAudio);
        screenSharingRef.current = true;
        setScreenSharing(true);
        setBroadcastPreviewOpen(true);
        setSidebarOpen(true);

        await publishStream(stream);
        await applyScreenEncoding(screenShareQuality);

        if (screenTrack.readyState !== "live") {
          void stopScreenShare();
        }
      } catch {
        screenSharingRef.current = false;
        releaseShareTracks();
        setScreenSharing(false);
      }
    },
    [
      acquireMicTrack,
      applyShareAudio,
      applyScreenEncoding,
      broadcastMedia,
      cameraEnabled,
      localStream,
      micEnabled,
      publishStream,
      screenShareQuality,
      stopScreenShare,
    ]
  );

  const updateMedia = async (nextMic: boolean, nextCamera: boolean) => {
    const prevMic = micEnabled;
    const prevCamera = cameraEnabled;

    setMediaError(null);
    setMicEnabled(nextMic);
    setCameraEnabled(nextCamera);

    try {
      if (screenSharing) {
        let stream = localStream;
        if (!stream) {
          stream = new MediaStream();
        }

        if (nextMic) {
          await acquireMicTrack();
        } else if (micTrackRef.current) {
          micTrackRef.current.enabled = false;
        }

        const displayStream = displayAudioTrackRef.current
          ? new MediaStream([displayAudioTrackRef.current])
          : new MediaStream();

        applyShareAudio(stream, displayStream, nextMic);
        await publishStream(stream);
        broadcastMedia(nextMic, nextCamera, true, !!displayAudioTrackRef.current);
        resumeMediaPlayback();
        return;
      }

      let stream = localStream;

      if (nextMic || nextCamera) {
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: nextMic,
            video: nextCamera,
          });
          if (nextMic) {
            const track = stream.getAudioTracks()[0];
            if (track) {
              tagMicTrack(track);
              micTrackRef.current = track;
            }
          }
        } else {
          if (nextMic) {
            const liveMic = stream
              .getAudioTracks()
              .find((track) => track.readyState === "live");
            if (liveMic) {
              liveMic.enabled = true;
              tagMicTrack(liveMic);
              micTrackRef.current = liveMic;
            } else {
              const track = await acquireMicTrack();
              if (track) {
                for (const old of stream.getAudioTracks()) {
                  old.stop();
                  stream.removeTrack(old);
                }
                stream.addTrack(track);
              }
            }
          } else {
            stream.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
          }

          if (nextCamera && !stream.getVideoTracks().length) {
            const video = await navigator.mediaDevices.getUserMedia({ video: true });
            video.getVideoTracks().forEach((track) => stream?.addTrack(track));
          }
        }

        stream.getVideoTracks().forEach((track) => {
          track.enabled = nextCamera;
        });
    } else if (stream) {
      stopMediaStream(stream);
      micTrackRef.current = null;
      stream = null;
    }

      await publishStream(stream);
      broadcastMedia(nextMic, nextCamera, false, false);
      resumeMediaPlayback();
    } catch (err) {
      setMicEnabled(prevMic);
      setCameraEnabled(prevCamera);
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Allow mic access in the browser, then try again."
          : err instanceof Error
            ? err.message
            : "Could not access microphone";
      setMediaError(message);
    }
  };

  // Honor mic/camera choices made in the onboarding stepper (3-A): enable them
  // once, right after the local user is in the space.
  const autoMediaDoneRef = useRef(false);
  useEffect(() => {
    if (autoMediaDoneRef.current || !localUser) return;
    if (!wantMic && !wantCam) return;
    autoMediaDoneRef.current = true;
    void updateMedia(wantMic, wantCam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUser]);

  const handleStatusChange = (status: UserStatus) => {
    getSocket().emit("user:status", status);
    setLocalUser((current) => (current ? { ...current, status } : current));
  };

  const handleSendMessage = (text: string, scope: "nearby" | "floor" | "all") => {
    getSocket().emit("chat:send", { text, scope });
  };

  const releaseAllMedia = useCallback(() => {
    releaseShareTracks();
    stopMediaStream(localStream);
    stopMediaTrack(micTrackRef.current);
    micTrackRef.current = null;
    setLocalStream(null);
    setScreenSharing(false);
    void webrtcRef.current?.setLocalStream(null);
    void webrtcRef.current?.setScreenShareEncoding(null);
  }, [localStream, releaseShareTracks]);

  useEffect(() => {
    const onPageHide = () => {
      if (!screenSharingRef.current) return;
      void stopScreenShare();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [stopScreenShare]);

  const handleLeave = () => {
    releaseAllMedia();
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
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--paper)] px-6 text-center">
        <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-6 py-5">
          <p className="text-sm text-[var(--accent-hover)]">{error ?? "Unable to join space"}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--accent-hover)]"
        >
          Back home
        </button>
      </div>
    );
  }

  const onlineCount = users.length;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[var(--paper)]">
      <SpatialAudio
        localUser={localUser}
        users={users}
        remoteStreams={remoteStreams}
        peerMicMuted={peerMicMuted}
        peerScreenAudioMuted={peerScreenAudioMuted}
      />
      <div className="flex h-full">
        {/* Office canvas area */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Top-left floating header */}
          <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-md)]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
                <span className="text-[12px] font-bold">◐</span>
              </div>
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-[12px] font-semibold text-[var(--ink)]">
                  {spaceId}
                </p>
                <p className="flex items-center gap-1 text-[10px] text-[var(--ink-soft)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-ok)]" />
                  <Users className="h-2.5 w-2.5" />
                  {onlineCount} online
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                title="Copy space link"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-faint)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {copied && (
                <span className="text-[10px] font-medium text-[var(--status-ok)]">copied!</span>
              )}
            </div>
          </div>

          {screenSharing && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-md)]">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                  </span>
                  You are presenting
                </span>
                <button
                  type="button"
                  onClick={() => void stopScreenShare()}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-hover)] transition hover:bg-[var(--accent)]/15"
                >
                  <MonitorOff className="h-3.5 w-3.5" />
                  Stop share
                </button>
              </div>
            </div>
          )}

          {/* Online users floating chip + invite */}
          <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
            <OnlineUsersChip users={users} localUserId={localUser.id} />
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-md)] transition hover:bg-[var(--surface-2)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-md)] transition hover:bg-[var(--surface-2)]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          </div>

          {inviteOpen && (
            <InviteModal spaceId={spaceId} onClose={() => setInviteOpen(false)} />
          )}

          {editorOpen && (
            <SpaceEditor
              spaceId={spaceId}
              map={officeMap}
              onPublish={(map) => {
                setOfficeMap(map);
                getSocket().emit("space:map:set", map);
              }}
              onClose={() => setEditorOpen(false)}
            />
          )}

          {/* Office canvas */}
          <div className="absolute inset-0 p-4">
            <OfficeCanvas
              users={users}
              localUser={localUser}
              onMove={emitMove}
              messages={messages}
              map={officeMap}
            />
          </div>

          {/* Floating minimap (5-A) */}
          <MiniMap users={users} localUserId={localUser.id} map={officeMap} />

          {screenSharing && localStream && broadcastPreviewOpen && (
            <BroadcastPreview
              stream={localStream}
              onMinimize={() => setBroadcastPreviewOpen(false)}
              broadcasterId={localUser.id}
              strokes={myStrokes}
              onClear={emitAnnotationClear}
            />
          )}

          {screenSharing && localStream && !broadcastPreviewOpen && (
            <button
              type="button"
              onClick={() => setBroadcastPreviewOpen(true)}
              className="pointer-events-auto absolute bottom-24 left-4 z-[45] flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-md)] transition hover:bg-[var(--paper-2)]"
            >
              <Monitor className="h-3.5 w-3.5" />
              Show broadcast preview
            </button>
          )}

          {mediaError && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 max-w-md -translate-x-1/2 px-4">
              <p className="pointer-events-auto rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-2 text-center text-[12px] text-[var(--accent-hover)] shadow-[var(--shadow-md)]">
                {mediaError}
              </p>
            </div>
          )}

          {/* Floating control dock */}
          <ControlBar
            localUser={localUser}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            screenSharing={screenSharing}
            anyonePresenting={anyonePresenting}
            annotateDrawing={annotateDrawing}
            onToggleAnnotateDrawing={() => {
              setAnnotateDrawing((v) => {
                const next = !v;
                if (next) setSidebarOpen(true);
                return next;
              });
            }}
            annotationColor={annotationColor}
            onAnnotationColorChange={setAnnotationColor}
            sidebarOpen={sidebarOpen}
            onToggleMic={() => updateMedia(!micEnabled, cameraEnabled)}
            onToggleCamera={() => updateMedia(micEnabled, !cameraEnabled)}
            screenShareQuality={screenShareQuality}
            onScreenShareQualityChange={(id) => void handleScreenShareQualityChange(id)}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={() => void stopScreenShare()}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            onStatusChange={handleStatusChange}
            onLeave={handleLeave}
          />
        </div>

        <ResizableSidebar
          open={sidebarOpen}
          presenting={anyonePresenting}
          onClose={() => setSidebarOpen(false)}
          header={
            <SidebarHeader
              presenter={activePresenter}
              localUserId={localUser.id}
              watcherCount={watcherCount}
              onlineCount={users.length}
              onClose={() => setSidebarOpen(false)}
              onStopSharing={
                screenSharing ? () => void stopScreenShare() : undefined
              }
            />
          }
          top={
            <VideoGrid
              localUser={localUser}
              localScreenSharing={screenSharing}
              users={users}
              localStream={localStream}
              remoteStreams={remoteStreams}
              peerStates={peerStates}
              peerMicMuted={peerMicMuted}
              peerScreenAudioMuted={peerScreenAudioMuted}
              onTogglePeerAudioMute={togglePeerAudioMute}
              annotations={annotations}
              localUserId={localUser.id}
              annotationColor={annotationColor}
              onAnnotationColorChange={setAnnotationColor}
              onAnnotationStroke={emitAnnotationStroke}
              onAnnotationClear={emitAnnotationClear}
              annotateDrawing={annotateDrawing}
              onToggleAnnotateDrawing={() => {
                setAnnotateDrawing((v) => {
                  const next = !v;
                  if (next) setSidebarOpen(true);
                  return next;
                });
              }}
            />
          }
          bottom={
            <ChatPanel
              messages={messages}
              onSend={handleSendMessage}
              currentUserId={localUser.id}
              currentZone={currentZone}
              typingUsers={Array.from(typingUsers.values()).filter(
                (entry) => entry.userId !== localUser.id
              )}
            />
          }
        />
      </div>
    </div>
  );
}

function SidebarHeader({
  presenter,
  localUserId,
  watcherCount,
  onlineCount,
  onClose,
  onStopSharing,
}: {
  presenter: User | null;
  localUserId: string;
  watcherCount: number;
  onlineCount: number;
  onClose: () => void;
  onStopSharing?: () => void;
}) {
  const isLocalPresenter = presenter?.id === localUserId;

  if (!presenter) {
    return (
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper-2)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--status-ok)]/15 ring-1 ring-[var(--status-ok)]/30">
            <Users className="h-3 w-3 text-[var(--status-ok)]" />
          </span>
          <div className="leading-tight">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-soft)]">
              Floor activity
            </p>
            <p className="text-[10px] text-[var(--ink-faint)]">{onlineCount} online</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--ink-faint)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30">
          <Monitor className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[12px] font-semibold text-[var(--ink)]">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full align-middle ring-1 ring-white"
              style={{ backgroundColor: presenter.color }}
            />
            {isLocalPresenter ? "You" : presenter.name} is sharing
          </p>
          <p className="text-[10px] text-[var(--ink-soft)]">
            {watcherCount} {watcherCount === 1 ? "viewer" : "viewers"}
            <span className="mx-1 text-[var(--ink-faint)]">·</span>
            {onlineCount} online
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onStopSharing && (
          <button
            type="button"
            onClick={onStopSharing}
            className="flex items-center gap-1 rounded-lg bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-medium text-[var(--accent-hover)] transition hover:bg-[var(--accent)]/25"
            aria-label="Stop sharing"
            title="Stop sharing"
          >
            <PhoneOff className="h-3 w-3" />
            Stop
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--ink-faint)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MiniMap({
  users,
  localUserId,
  map,
}: {
  users: User[];
  localUserId: string;
  map: OfficeMap;
}) {
  const scale = Math.min(152 / map.width, 78 / map.height);
  const mapW = map.width * scale;
  const mapH = map.height * scale;

  return (
    <div className="pointer-events-none absolute bottom-6 left-4 z-30 hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)] sm:block">
      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
        Map
      </div>
      <div
        className="relative overflow-hidden rounded bg-[var(--floor-2)]"
        style={{ width: mapW, height: mapH }}
      >
        {map.zones.map((zone) => (
          <div
            key={zone.id}
            className="absolute rounded-[2px] border border-[var(--wall-2)]/50"
            style={{
              left: zone.x * scale,
              top: zone.y * scale,
              width: zone.width * scale,
              height: zone.height * scale,
              background:
                zone.type === "meeting" || zone.type === "focus"
                  ? "var(--room-warm)"
                  : "var(--room)",
            }}
          />
        ))}
        {users.map((user) => {
          const isLocal = user.id === localUserId;
          return (
            <div
              key={user.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
              style={{
                left: user.x * scale,
                top: user.y * scale,
                width: isLocal ? 7 : 5,
                height: isLocal ? 7 : 5,
                background: user.color,
                boxShadow: isLocal ? "0 0 0 2px var(--accent-ring)" : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function OnlineUsersChip({ users, localUserId }: { users: User[]; localUserId: string }) {
  const others = users.filter((u) => u.id !== localUserId).slice(0, 5);

  if (others.length === 0) return null;

  return (
    <div className="pointer-events-auto hidden md:block">
      <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-md)]">
        <div className="flex -space-x-2">
          {others.map((user) => (
            <div
              key={user.id}
              title={user.name}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
        {users.length - 1 > others.length && (
          <span className="text-[11px] font-medium text-[var(--ink-soft)]">
            +{users.length - 1 - others.length}
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="relative flex h-[100dvh] items-center justify-center overflow-hidden bg-[var(--paper)]">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-[var(--shadow-lg)]">
          <span className="text-2xl font-bold text-white">◐</span>
          <span className="absolute -inset-1 rounded-2xl ring-2 ring-[var(--accent-ring)] speak-pulse" />
        </div>
        <p className="text-[13px] text-[var(--ink-soft)]">Stepping into the space…</p>
      </div>
    </div>
  );
}
