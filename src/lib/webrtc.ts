"use client";

import { getSocket } from "./socket";

type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private remoteStreams = new Map<string, MediaStream>();
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

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    for (const [peerId, pc] of this.peers) {
      const senders = pc.getSenders();
      for (const sender of senders) {
        pc.removeTrack(sender);
      }

      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      if (pc.signalingState === "stable") {
        await this.createOffer(peerId);
      }
    }
  }

  async syncPeers(activePeerIds: string[]) {
    const activeSet = new Set(activePeerIds);

    for (const peerId of [...this.peers.keys()]) {
      if (!activeSet.has(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of activePeerIds) {
      if (!this.peers.has(peerId)) {
        await this.createPeerConnection(peerId, false);
      }
    }
  }

  private createPeerConnectionConfig(): RTCConfiguration {
    return {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
  }

  private async createPeerConnection(peerId: string, initiator: boolean) {
    const pc = new RTCPeerConnection(this.createPeerConnectionConfig());
    this.peers.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit("webrtc:signal", {
          to: peerId,
          signal: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStreams.set(peerId, stream);
        this.onRemoteStream?.(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    if (initiator) {
      await this.createOffer(peerId);
    }
  }

  private async createOffer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || this.makingOffer.has(peerId)) return;

    this.makingOffer.add(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit("webrtc:signal", {
        to: peerId,
        signal: offer,
      });
    } finally {
      this.makingOffer.delete(peerId);
    }
  }

  private async handleSignal(peerId: string, signal: SignalPayload) {
    let pc = this.peers.get(peerId);

    if (!pc) {
      await this.createPeerConnection(peerId, false);
      pc = this.peers.get(peerId);
    }

    if (!pc) return;

    if ("type" in signal && (signal.type === "offer" || signal.type === "answer")) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));

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
      await pc.addIceCandidate(new RTCIceCandidate(signal));
    }
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
    this.onRemoteStream?.(peerId, null);
  }

  destroy() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    getSocket().off("webrtc:signal");
  }
}
