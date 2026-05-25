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

    if (this.localStream) {
      await audioTransceiver.sender.replaceTrack(
        this.localStream.getAudioTracks()[0] ?? null
      );
      await videoTransceiver.sender.replaceTrack(
        this.localStream.getVideoTracks()[0] ?? null
      );
    }

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
        const audioTrack = stream?.getAudioTracks()[0] ?? null;
        const videoTrack = stream?.getVideoTracks()[0] ?? null;

        const prevAudio = entry.audioTransceiver.sender.track;
        const prevVideo = entry.videoTransceiver.sender.track;

        await entry.audioTransceiver.sender.replaceTrack(audioTrack);
        await entry.videoTransceiver.sender.replaceTrack(videoTrack);

        console.log(
          `[webrtc] sending to ${peerId}: audio=${!!audioTrack} video=${!!videoTrack}`
        );

        // Renegotiate when a track is added or removed so the SDP carries the
        // new SSRC/msid. Modern perfect negotiation handles glare if the other
        // side renegotiates at the same time.
        const trackChanged =
          (audioTrack ? audioTrack.id : null) !== (prevAudio ? prevAudio.id : null) ||
          (videoTrack ? videoTrack.id : null) !== (prevVideo ? prevVideo.id : null);

        if (trackChanged) {
          await this.negotiate(peerId);
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
  }
}
