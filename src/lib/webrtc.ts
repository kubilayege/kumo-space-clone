"use client";

import { getSocket } from "./socket";

type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

interface PeerEntry {
  pc: RTCPeerConnection;
  audioTransceiver: RTCRtpTransceiver;
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
  private silentAudioCtx: AudioContext | null = null;
  private silentAudioTrack: MediaStreamTrack | null = null;
  private silentVideoTrack: MediaStreamTrack | null = null;

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
  private getSilentAudioTrack(): MediaStreamTrack {
    if (this.silentAudioTrack && this.silentAudioTrack.readyState === "live") {
      return this.silentAudioTrack;
    }
    if (!this.silentAudioCtx) {
      this.silentAudioCtx = new AudioContext();
    }
    const oscillator = this.silentAudioCtx.createOscillator();
    const dst = this.silentAudioCtx.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false;
    this.silentAudioTrack = track;
    return track;
  }

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
    track.enabled = false;
    this.silentVideoTrack = track;
    return track;
  }

  private resolveAudioTrack(): MediaStreamTrack {
    return this.localStream?.getAudioTracks()[0] ?? this.getSilentAudioTrack();
  }

  private resolveVideoTrack(): MediaStreamTrack {
    return this.localStream?.getVideoTracks()[0] ?? this.getSilentVideoTrack();
  }

  private shouldInitiate(peerId: string): boolean {
    if (!this.localPeerId) return false;
    return this.localPeerId.localeCompare(peerId) < 0;
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
    const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
    const remoteStream = new MediaStream();

    const entry: PeerEntry = {
      pc,
      audioTransceiver,
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
      const sameKind = entry.remoteStream
        .getTracks()
        .filter((t) => t.kind === incoming.kind);
      for (const existing of sameKind) {
        if (existing.id !== incoming.id) entry.remoteStream.removeTrack(existing);
      }
      if (!entry.remoteStream.getTracks().some((t) => t.id === incoming.id)) {
        entry.remoteStream.addTrack(incoming);
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
        `[webrtc] track from ${peerId}: kind=${incoming.kind} muted=${incoming.muted} state=${incoming.readyState}`
      );
    };

    pc.onconnectionstatechange = () => {
      console.log(`[webrtc] ${peerId} connection: ${pc.connectionState}`);
      this.onPeerState?.(peerId, this.mapState(pc.connectionState));
      if (pc.connectionState === "connected" && !entry.statsTimer) {
        console.log(
          `[webrtc] ${peerId} directions: audio=${entry.audioTransceiver.currentDirection} video=${entry.videoTransceiver.currentDirection}`
        );
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

    await audioTransceiver.sender.replaceTrack(this.resolveAudioTrack());
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

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    for (const [peerId, entry] of this.peers) {
      try {
        const audioTrack = this.resolveAudioTrack();
        const videoTrack = this.resolveVideoTrack();

        await entry.audioTransceiver.sender.replaceTrack(audioTrack);
        await entry.videoTransceiver.sender.replaceTrack(videoTrack);

        console.log(
          `[webrtc] sending to ${peerId}: audio=${!!stream?.getAudioTracks()[0]} video=${!!stream?.getVideoTracks()[0]}`
        );
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
          `[webrtc] ${peerId} directions: audio=${entry.audioTransceiver.currentDirection} video=${entry.videoTransceiver.currentDirection}`
        );
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
    this.silentAudioTrack?.stop();
    this.silentVideoTrack?.stop();
    this.silentAudioTrack = null;
    this.silentVideoTrack = null;
    void this.silentAudioCtx?.close().catch(() => {});
    this.silentAudioCtx = null;
  }
}
