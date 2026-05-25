"use client";

import { getSocket } from "./socket";

type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

interface PeerEntry {
  pc: RTCPeerConnection;
  audioTransceiver: RTCRtpTransceiver;
  videoTransceiver: RTCRtpTransceiver;
  remoteStream: MediaStream;
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

    const entry: PeerEntry = { pc, audioTransceiver, videoTransceiver, remoteStream };
    this.peers.set(peerId, entry);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const incoming = event.track;
      const sameKind = remoteStream.getTracks().filter((t) => t.kind === incoming.kind);
      for (const existing of sameKind) {
        if (existing.id !== incoming.id) remoteStream.removeTrack(existing);
      }
      if (!remoteStream.getTracks().some((t) => t.id === incoming.id)) {
        remoteStream.addTrack(incoming);
      }

      incoming.onunmute = () => this.onRemoteStream?.(peerId, remoteStream);
      this.onRemoteStream?.(peerId, remoteStream);

      if (typeof window !== "undefined") {
        console.log(`[webrtc] track from ${peerId}: kind=${incoming.kind} live=${incoming.readyState}`);
      }
    };

    pc.onconnectionstatechange = () => {
      if (typeof window !== "undefined") {
        console.log(`[webrtc] ${peerId} connection: ${pc.connectionState}`);
      }
      this.onPeerState?.(peerId, this.mapState(pc.connectionState));
      if (pc.connectionState === "failed") {
        pc.restartIce();
      }
      if (pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (typeof window !== "undefined") {
        console.log(`[webrtc] ${peerId} ice: ${pc.iceConnectionState}`);
      }
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
        await entry.audioTransceiver.sender.replaceTrack(
          stream?.getAudioTracks()[0] ?? null
        );
        await entry.videoTransceiver.sender.replaceTrack(
          stream?.getVideoTracks()[0] ?? null
        );
      } catch (err) {
        console.warn(`[webrtc] replaceTrack failed for ${peerId}:`, err);
      }
    }
  }

  private async negotiate(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry || this.makingOffer.has(peerId)) return;
    const { pc } = entry;
    if (pc.signalingState !== "stable") return;

    this.makingOffer.add(peerId);
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      getSocket().emit("webrtc:signal", {
        to: peerId,
        signal: offer,
      });
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
        console.warn(`[webrtc] queued ICE add failed for ${peerId}:`, err);
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
      const offerCollision =
        signal.type === "offer" &&
        (this.makingOffer.has(peerId) || pc.signalingState !== "stable");

      if (offerCollision && !polite) {
        return;
      }

      try {
        if (offerCollision && polite) {
          await Promise.all([
            pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit),
            pc.setRemoteDescription(new RTCSessionDescription(signal)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        }
      } catch (err) {
        console.warn(`[webrtc] setRemoteDescription failed for ${peerId}:`, err);
        return;
      }

      await this.flushPendingCandidates(peerId);

      if (signal.type === "offer") {
        try {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          getSocket().emit("webrtc:signal", {
            to: peerId,
            signal: answer,
          });
        } catch (err) {
          console.warn(`[webrtc] answer failed for ${peerId}:`, err);
        }
      }
      return;
    }

    if ("candidate" in signal && signal.candidate) {
      if (!pc.remoteDescription) {
        const queue = this.pendingCandidates.get(peerId) ?? [];
        queue.push(signal);
        this.pendingCandidates.set(peerId, queue);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      } catch (err) {
        console.warn(`[webrtc] ICE add failed for ${peerId}:`, err);
      }
    }
  }

  removePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
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
