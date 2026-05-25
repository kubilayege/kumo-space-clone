"use client";

import { getSocket } from "./socket";

type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

export class WebRTCManager {
  private localPeerId = "";
  private peers = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private onRemoteStream?: (peerId: string, stream: MediaStream | null) => void;
  private makingOffer = new Set<string>();

  constructor(onRemoteStream?: (peerId: string, stream: MediaStream | null) => void) {
    this.onRemoteStream = onRemoteStream;
    this.setupSignaling();
  }

  private setupSignaling() {
    const socket = getSocket();
    socket.on(
      "webrtc:signal",
      async (payload: { from: string; signal: SignalPayload }) => {
        await this.handleSignal(payload.from, payload.signal);
      }
    );
  }

  private shouldInitiate(peerId: string): boolean {
    if (!this.localPeerId) return false;
    return this.localPeerId.localeCompare(peerId) < 0;
  }

  private createPeerConnectionConfig(): RTCConfiguration {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
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
    };
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    for (const [peerId, pc] of this.peers) {
      const senders = pc.getSenders();

      for (const sender of senders) {
        if (sender.track) {
          pc.removeTrack(sender);
        }
      }

      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      if (this.shouldInitiate(peerId) && pc.signalingState === "stable") {
        await this.createOffer(peerId);
      }
    }
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
    const pc = new RTCPeerConnection(this.createPeerConnectionConfig());
    this.peers.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const stream =
        event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream?.(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        pc.restartIce();
      }
      if (pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    pc.onnegotiationneeded = async () => {
      if (this.shouldInitiate(peerId)) {
        await this.createOffer(peerId);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    if (this.shouldInitiate(peerId) && !skipInitialOffer) {
      await this.createOffer(peerId);
    }
  }

  private async createOffer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || this.makingOffer.has(peerId)) return;
    if (pc.signalingState !== "stable") return;

    this.makingOffer.add(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit("webrtc:signal", {
        to: peerId,
        signal: offer,
      });
    } catch {
      return;
    } finally {
      this.makingOffer.delete(peerId);
    }
  }

  private async flushPendingCandidates(peerId: string) {
    const pc = this.peers.get(peerId);
    const queued = this.pendingCandidates.get(peerId) ?? [];
    this.pendingCandidates.delete(peerId);
    if (!pc) return;

    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async handleSignal(peerId: string, signal: SignalPayload) {
    let pc = this.peers.get(peerId);

    if (!pc) {
      await this.createPeerConnection(peerId, true);
      pc = this.peers.get(peerId);
    }

    if (!pc) return;

    if ("type" in signal && (signal.type === "offer" || signal.type === "answer")) {
      if (signal.type === "offer" && pc.signalingState !== "stable") {
        if (this.shouldInitiate(peerId)) {
          return;
        }
        await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await this.flushPendingCandidates(peerId);

      if (signal.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: answer,
        });
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
      await pc.addIceCandidate(new RTCIceCandidate(signal));
    }
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    this.onRemoteStream?.(peerId, null);
  }

  destroy() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    getSocket().off("webrtc:signal");
  }
}
