"use client";

import { io, Socket } from "socket.io-client";
import { ChatMessage, User } from "./types";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001", {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function joinSpace(
  spaceId: string,
  name: string,
  color?: string
): Promise<{ user: User; users: User[]; messages: ChatMessage[] }> {
  const client = getSocket();

  return new Promise((resolve, reject) => {
    if (!client.connected) {
      client.connect();
    }

    client.emit(
      "space:join",
      { spaceId, name, color },
      (response: { user: User; users: User[]; messages: ChatMessage[] }) => {
        if (response?.user) {
          resolve(response);
        } else {
          reject(new Error("Failed to join space"));
        }
      }
    );

    setTimeout(() => reject(new Error("Connection timed out")), 8000);
  });
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
