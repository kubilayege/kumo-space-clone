"use client";

import { classifyAudioTrack } from "./screenShare";
import { getSocket } from "./socket";

type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

interface PeerEntry {
  pc: RTCPeerConnection;
  micTransceiver: RTCRtpTransceiver;
  screenAudioTransceiver: RTCRtpTransceiver;
  videoTransceiver: RTCRtpTransceiver;
  remoteStream: MediaStream;
  statsTimer?: ReturnType<typeof setInterval>;
  isSettingRemoteAnswerPending: boolean;
  ignoreOffer: boolean;
}

export type ConnectionState = "new" | "connecting" | "connected" | "failed";

export class WebRTCManager {
  private localPeerId = "";
  private peers = new Map<string, PeerEntry>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private onRemoteStream?: (peerId: string, stream: MediaStream | null) => void;
  private onPeerState?: (peerId: string, state: ConnectionState) => void;
  private makingOffer = new Set<string>();
  private signalHandler: (payload: { from: string; signal: SignalPayload }) => void;
  private silentVideoTrack: MediaStreamTrack | null = null;
  private screenShareEncoding: { maxBitrate: number; maxFramerate: number } | null = null;

  constructor(
    onRemoteStream?: (peerId: string, stream: MediaStream | null) => void,
    onPeerState?: (peerId: string, state: ConnectionState) => void
  ) {
    this.onRemoteStream = onRemoteStream;
    this.onPeerState = onPeerState;
    this.signalHandler = (payload) => {
      void this.handleSignal(payload.from, payload.signal);
    };
    getSocket().on("webrtc:signal", this.signalHandler);
  }

  // Silent placeholder tracks keep the SDP m-line direction at "sendrecv" on
  // both sides regardless of whether the user has enabled their mic/cam yet.
  // Without this, a peer with no local track answers recvonly per JSEP, which
  // pins the other side to sendonly even after they later toggle their device
  // on (since their second renegotiation can again find us trackless).
  private getSilentVideoTrack(): MediaStreamTrack {
    if (this.silentVideoTrack && this.silentVideoTrack.readyState === "live") {
      return this.silentVideoTrack;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx2d = canvas.getContext("2d");
    if (ctx2d) {
      ctx2d.fillStyle = "#000";
      ctx2d.fillRect(0, 0, 16, 16);
    }
    const stream = (canvas as HTMLCanvasElement & {
      captureStream: (frameRate?: number) => MediaStream;
    }).captureStream(1);
    const track = stream.getVideoTracks()[0];
    track.enabled = true;
    this.silentVideoTrack = track;
    return track;
  }

  // Returns the first live, enabled audio track of the given semantic kind.
  // We classify by contentHint so that mic and screen audio land on dedicated
  // transceivers and are kept separate end-to-end.
  private resolveAudioTrackFor(kind: "mic" | "screen"): MediaStreamTrack | null {
    if (!this.localStream) return null;
    return (
      this.localStream
        .getAudioTracks()
        .find(
          (track) =>
            track.readyState === "live" &&
            track.enabled &&
            classifyAudioTrack(track) === kind
        ) ?? null
    );
  }

  private resolveVideoTrack(): MediaStreamTrack {
    return this.localStream?.getVideoTracks()[0] ?? this.getSilentVideoTrack();
  }

  private shouldInitiate(peerId: string): boolean {
    if (!this.localPeerId) return false;
    return this.localPeerId.localeCompare(peerId) < 0;
  }

  private async ensureSendRecv(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.pc.signalingState !== "stable") return;

    let changed = false;
    if (entry.micTransceiver.direction !== "sendrecv") {
      entry.micTransceiver.direction = "sendrecv";
      changed = true;
    }
    if (entry.screenAudioTransceiver.direction !== "sendrecv") {
      entry.screenAudioTransceiver.direction = "sendrecv";
      changed = true;
    }
    if (entry.videoTransceiver.direction !== "sendrecv") {
      entry.videoTransceiver.direction = "sendrecv";
      changed = true;
    }

    if (changed) {
      await this.negotiate(peerId);
    }
  }

  private rtcConfig(): RTCConfiguration {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 4,
    };
  }

  async syncPeers(activePeerIds: string[], localPeerId: string) {
    this.localPeerId = localPeerId;
    const activeSet = new Set(activePeerIds);

    for (const peerId of [...this.peers.keys()]) {
      if (!activeSet.has(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of activePeerIds) {
      if (!this.peers.has(peerId)) {
        await this.createPeerConnection(peerId);
      }
    }
  }

  private async createPeerConnection(peerId: string, skipInitialOffer = false) {
    const pc = new RTCPeerConnection(this.rtcConfig());
    // First audio transceiver carries the microphone, second carries screen
    // audio. Keeping them on separate m-sections lets receivers mute one
    // without affecting the other.
    const micTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    const screenAudioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
    const remoteStream = new MediaStream();

    const entry: PeerEntry = {
      pc,
      micTransceiver,
      screenAudioTransceiver,
      videoTransceiver,
      remoteStream,
      isSettingRemoteAnswerPending: false,
      ignoreOffer: false,
    };
    this.peers.set(peerId, entry);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: event.candidate.toJSON(),
        });
      }
    };

    const publishStream = () => {
      const fresh = new MediaStream(entry.remoteStream.getTracks());
      entry.remoteStream = fresh;
      this.onRemoteStream?.(peerId, fresh);
    };

    pc.ontrack = (event) => {
      const incoming = event.track;
      // For audio we replace the previous track on the *same transceiver*
      // (i.e. same m-line) when SSRCs change, while still allowing the two
      // audio transceivers to coexist. Video stays single-track so we keep
      // the kind-based dedupe for it.
      if (incoming.kind === "video") {
        const sameKind = entry.remoteStream
          .getTracks()
          .filter((t) => t.kind === incoming.kind);
        for (const existing of sameKind) {
          if (existing.id !== incoming.id) entry.remoteStream.removeTrack(existing);
        }
      } else if (incoming.kind === "audio") {
        const receiver = event.receiver;
        for (const existing of entry.remoteStream.getAudioTracks()) {
          if (existing.id === incoming.id) continue;
          // Heuristic: drop tracks attached to the same transceiver/receiver
          // (means the SSRC for that mid was replaced).
          const isSameReceiver = entry.pc
            .getReceivers()
            .some((r) => r === receiver && r.track?.id === existing.id);
          if (isSameReceiver) {
            entry.remoteStream.removeTrack(existing);
          }
        }
      }
      if (!entry.remoteStream.getTracks().some((t) => t.id === incoming.id)) {
        entry.remoteStream.addTrack(incoming);
      }

      // Reflect the sender's contentHint on the receiver side as well so
      // downstream components can identify mic vs screen audio cleanly.
      if (incoming.kind === "audio") {
        const transceiver = event.transceiver;
        const inferredHint =
          transceiver === entry.screenAudioTransceiver
            ? "music"
            : transceiver === entry.micTransceiver
              ? "speech"
              : incoming.contentHint;
        try {
          incoming.contentHint = inferredHint;
        } catch {
          // ignore
        }
      }

      publishStream();

      incoming.onunmute = () => {
        console.log(`[webrtc] ${peerId} ${incoming.kind} unmuted`);
        publishStream();
      };
      incoming.onmute = () => {
        console.log(`[webrtc] ${peerId} ${incoming.kind} muted`);
      };
      incoming.onended = () => {
        console.log(`[webrtc] ${peerId} ${incoming.kind} ended`);
      };

      console.log(
        `[webrtc] track from ${peerId}: kind=${incoming.kind} hint=${incoming.contentHint} muted=${incoming.muted} state=${incoming.readyState}`
      );
    };

    pc.onconnectionstatechange = () => {
      console.log(`[webrtc] ${peerId} connection: ${pc.connectionState}`);
      this.onPeerState?.(peerId, this.mapState(pc.connectionState));
      if (pc.connectionState === "connected" && !entry.statsTimer) {
        console.log(
          `[webrtc] ${peerId} directions: mic=${entry.micTransceiver.currentDirection} screen=${entry.screenAudioTransceiver.currentDirection} video=${entry.videoTransceiver.currentDirection}`
        );
        void this.ensureSendRecv(peerId);
        void this.applyVideoEncoding(peerId, entry);
        entry.statsTimer = setInterval(() => this.logStats(peerId), 5000);
      }
      if (pc.connectionState === "failed") {
        pc.restartIce();
      }
      if (pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[webrtc] ${peerId} ice: ${pc.iceConnectionState}`);
    };

    pc.onnegotiationneeded = () => {
      void this.negotiate(peerId);
    };

    await micTransceiver.sender.replaceTrack(this.resolveAudioTrackFor("mic"));
    await screenAudioTransceiver.sender.replaceTrack(
      this.resolveAudioTrackFor("screen")
    );
    await videoTransceiver.sender.replaceTrack(this.resolveVideoTrack());

    if (!skipInitialOffer && this.shouldInitiate(peerId)) {
      await this.negotiate(peerId);
    }
  }

  private mapState(state: RTCPeerConnectionState): ConnectionState {
    if (state === "connected") return "connected";
    if (state === "failed" || state === "disconnected" || state === "closed") return "failed";
    if (state === "connecting" || state === "new") return state;
    return "new";
  }

  async setScreenShareEncoding(
    encoding: { maxBitrate: number; maxFramerate: number } | null
  ) {
    this.screenShareEncoding = encoding;
    for (const [peerId, entry] of this.peers) {
      await this.applyVideoEncoding(peerId, entry);
    }
  }

  private async applyVideoEncoding(peerId: string, entry: PeerEntry) {
    if (!this.screenShareEncoding) return;

    const sender = entry.videoTransceiver.sender;
    if (!sender.track || sender.track.kind !== "video") return;

    const params = sender.getParameters();
    const encodings = params.encodings?.length ? [...params.encodings] : [{}];
    encodings[0] = {
      ...encodings[0],
      maxBitrate: this.screenShareEncoding.maxBitrate,
      maxFramerate: this.screenShareEncoding.maxFramerate,
    };
    params.encodings = encodings;

    try {
      await sender.setParameters(params);
    } catch (err) {
      console.warn(`[webrtc] video encoding failed for ${peerId}:`, err);
    }
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    for (const [peerId, entry] of this.peers) {
      try {
        const micTrack = this.resolveAudioTrackFor("mic");
        const screenAudioTrack = this.resolveAudioTrackFor("screen");
        const videoTrack = this.resolveVideoTrack();

        await entry.micTransceiver.sender.replaceTrack(micTrack);
        await entry.screenAudioTransceiver.sender.replaceTrack(screenAudioTrack);
        await entry.videoTransceiver.sender.replaceTrack(videoTrack);

        console.log(
          `[webrtc] sending to ${peerId}: mic=${!!micTrack} screen=${!!screenAudioTrack} video=${!!stream?.getVideoTracks()[0]} directions mic=${entry.micTransceiver.currentDirection} screen=${entry.screenAudioTransceiver.currentDirection} video=${entry.videoTransceiver.currentDirection}`
        );

        await this.applyVideoEncoding(peerId, entry);

        if (entry.pc.signalingState === "stable") {
          await this.ensureSendRecv(peerId);
        }
      } catch (err) {
        console.warn(`[webrtc] replaceTrack failed for ${peerId}:`, err);
      }
    }
  }

  private async logStats(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    const stats = await entry.pc.getStats();
    let outAudio = 0;
    let inAudio = 0;
    let outVideo = 0;
    let inVideo = 0;
    let selectedPair: string | undefined;

    stats.forEach((report) => {
      if (report.type === "outbound-rtp" && report.kind === "audio") {
        outAudio = report.packetsSent ?? 0;
      }
      if (report.type === "inbound-rtp" && report.kind === "audio") {
        inAudio = report.packetsReceived ?? 0;
      }
      if (report.type === "outbound-rtp" && report.kind === "video") {
        outVideo = report.packetsSent ?? 0;
      }
      if (report.type === "inbound-rtp" && report.kind === "video") {
        inVideo = report.packetsReceived ?? 0;
      }
      if (report.type === "candidate-pair" && report.selected) {
        selectedPair = `${report.localCandidateId}->${report.remoteCandidateId}`;
      }
    });

    console.log(
      `[webrtc-stats] ${peerId} audio out=${outAudio} in=${inAudio} | video out=${outVideo} in=${inVideo} | pair=${selectedPair ?? "?"}`
    );
  }

  private async negotiate(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry || this.makingOffer.has(peerId)) return;
    const { pc } = entry;
    if (pc.signalingState !== "stable") return;

    this.makingOffer.add(peerId);
    try {
      await pc.setLocalDescription();
      if (pc.localDescription) {
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        });
      }
    } catch (err) {
      console.warn(`[webrtc] negotiate failed for ${peerId}:`, err);
    } finally {
      this.makingOffer.delete(peerId);
    }
  }

  private async flushPendingCandidates(peerId: string) {
    const entry = this.peers.get(peerId);
    const queued = this.pendingCandidates.get(peerId) ?? [];
    this.pendingCandidates.delete(peerId);
    if (!entry) return;

    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!entry.ignoreOffer) {
          console.warn(`[webrtc] queued ICE add failed for ${peerId}:`, err);
        }
      }
    }
  }

  private async handleSignal(peerId: string, signal: SignalPayload) {
    let entry = this.peers.get(peerId);

    if (!entry) {
      await this.createPeerConnection(peerId, true);
      entry = this.peers.get(peerId);
    }

    if (!entry) return;
    const { pc } = entry;

    if ("type" in signal && (signal.type === "offer" || signal.type === "answer")) {
      const polite = !this.shouldInitiate(peerId);
      const readyForOffer =
        !this.makingOffer.has(peerId) &&
        (pc.signalingState === "stable" || entry.isSettingRemoteAnswerPending);
      const offerCollision = signal.type === "offer" && !readyForOffer;

      entry.ignoreOffer = !polite && offerCollision;
      if (entry.ignoreOffer) {
        return;
      }

      if (signal.type === "answer" && pc.signalingState !== "have-local-offer") {
        // Stale answer for an offer we already rolled back. Drop it to avoid
        // "Called in wrong state: stable" errors.
        return;
      }

      try {
        entry.isSettingRemoteAnswerPending = signal.type === "answer";
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        entry.isSettingRemoteAnswerPending = false;
      } catch (err) {
        entry.isSettingRemoteAnswerPending = false;
        console.warn(`[webrtc] setRemoteDescription failed for ${peerId}:`, err);
        return;
      }

      await this.flushPendingCandidates(peerId);

      if (signal.type === "offer") {
        try {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            getSocket().emit("webrtc:signal", {
              to: peerId,
              signal: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
            });
          }
        } catch (err) {
          console.warn(`[webrtc] answer failed for ${peerId}:`, err);
        }
      }

      if (pc.signalingState === "stable") {
        console.log(
          `[webrtc] ${peerId} directions: mic=${entry.micTransceiver.currentDirection} screen=${entry.screenAudioTransceiver.currentDirection} video=${entry.videoTransceiver.currentDirection}`
        );
        await this.ensureSendRecv(peerId);
      }
      return;
    }

    if ("candidate" in signal) {
      if (!pc.remoteDescription) {
        const queue = this.pendingCandidates.get(peerId) ?? [];
        queue.push(signal);
        this.pendingCandidates.set(peerId, queue);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      } catch (err) {
        if (!entry.ignoreOffer) {
          console.warn(`[webrtc] ICE add failed for ${peerId}:`, err);
        }
      }
    }
  }

  removePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (entry) {
      if (entry.statsTimer) clearInterval(entry.statsTimer);
      entry.pc.close();
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    this.makingOffer.delete(peerId);
    this.onRemoteStream?.(peerId, null);
    this.onPeerState?.(peerId, "failed");
  }

  destroy() {
    getSocket().off("webrtc:signal", this.signalHandler);
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    this.silentVideoTrack?.stop();
    this.silentVideoTrack = null;
  }
}
