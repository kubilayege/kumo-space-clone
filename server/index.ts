import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  AVATAR_COLORS,
  ChatMessage,
  DEFAULT_OFFICE,
  User,
  UserStatus,
  clampPosition,
  distance,
  getZoneAt,
} from "../src/lib/types";

const PORT = Number(process.env.SOCKET_PORT ?? process.env.PORT ?? 3001);

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
const spaces = new Map<string, Map<string, User>>();
const chatHistory = new Map<string, ChatMessage[]>();

function getSpace(spaceId: string): Map<string, User> {
  if (!spaces.has(spaceId)) {
    spaces.set(spaceId, new Map());
    chatHistory.set(spaceId, []);
  }
  return spaces.get(spaceId)!;
}

function serializeUsers(users: Map<string, User>): User[] {
  return Array.from(users.values());
}

function broadcastUsers(io: Server, spaceId: string) {
  const users = getSpace(spaceId);
  io.to(spaceId).emit("users:update", serializeUsers(users));
}

function addChatMessage(spaceId: string, message: ChatMessage) {
  const history = chatHistory.get(spaceId) ?? [];
  history.push(message);
  if (history.length > 200) {
    history.splice(0, history.length - 200);
  }
  chatHistory.set(spaceId, history);
  return message;
}

function getNearbyUsers(user: User, users: Map<string, User>, range: number): User[] {
  return serializeUsers(users).filter(
    (other) => other.id !== user.id && distance(user, other) <= range
  );
}

const httpServer = new HttpServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Kumo Space Clone Socket Server");
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  let currentSpaceId: string | null = null;
  let currentUserId: string | null = null;

  socket.on(
    "space:join",
    (
      payload: {
        spaceId: string;
        name: string;
        color?: string;
      },
      callback?: (response: { user: User; users: User[]; messages: ChatMessage[] }) => void
    ) => {
      const { spaceId, name } = payload;
      const users = getSpace(spaceId);
      const color =
        payload.color ??
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const user: User = {
        id: socket.id,
        name: name.trim().slice(0, 24) || "Guest",
        color,
        x: DEFAULT_OFFICE.width / 2,
        y: DEFAULT_OFFICE.height / 2 + 40,
        status: "available",
        micEnabled: false,
        cameraEnabled: false,
      };

      users.set(socket.id, user);
      currentSpaceId = spaceId;
      currentUserId = socket.id;

      socket.join(spaceId);
      broadcastUsers(io, spaceId);

      callback?.({
        user,
        users: serializeUsers(users),
        messages: chatHistory.get(spaceId) ?? [],
      });
    }
  );

  socket.on("user:move", (payload: { x: number; y: number }) => {
    if (!currentSpaceId || !currentUserId) return;
    const users = getSpace(currentSpaceId);
    const user = users.get(currentUserId);
    if (!user) return;

    const clamped = clampPosition(payload.x, payload.y, DEFAULT_OFFICE);
    user.x = clamped.x;
    user.y = clamped.y;

    socket.to(currentSpaceId).emit("user:moved", {
      id: user.id,
      x: user.x,
      y: user.y,
    });
  });

  socket.on("user:status", (status: UserStatus) => {
    if (!currentSpaceId || !currentUserId) return;
    const users = getSpace(currentSpaceId);
    const user = users.get(currentUserId);
    if (!user) return;

    user.status = status;
    io.to(currentSpaceId).emit("user:updated", user);
  });

  socket.on("user:media", (payload: { micEnabled: boolean; cameraEnabled: boolean }) => {
    if (!currentSpaceId || !currentUserId) return;
    const users = getSpace(currentSpaceId);
    const user = users.get(currentUserId);
    if (!user) return;

    user.micEnabled = payload.micEnabled;
    user.cameraEnabled = payload.cameraEnabled;
    io.to(currentSpaceId).emit("user:updated", user);
  });

  socket.on(
    "chat:send",
    (payload: { text: string; scope: "nearby" | "floor" | "all" }) => {
      if (!currentSpaceId || !currentUserId) return;
      const users = getSpace(currentSpaceId);
      const user = users.get(currentUserId);
      if (!user) return;

      const text = payload.text.trim();
      if (!text) return;

      const zone = getZoneAt(user.x, user.y, DEFAULT_OFFICE);

      const message = addChatMessage(currentSpaceId, {
        id: uuidv4(),
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        text: text.slice(0, 500),
        scope: payload.scope,
        timestamp: Date.now(),
        zoneId: zone?.id,
      });

      if (payload.scope === "all" || payload.scope === "floor") {
        io.to(currentSpaceId).emit("chat:message", message);
        return;
      }

      const nearby = getNearbyUsers(user, users, 220);
      const recipients = new Set([user.id, ...nearby.map((u) => u.id)]);
      for (const recipientId of recipients) {
        io.to(recipientId).emit("chat:message", message);
      }
    }
  );

  socket.on(
    "webrtc:signal",
    (payload: { to: string; signal: RTCSessionDescriptionInit | RTCIceCandidateInit }) => {
      io.to(payload.to).emit("webrtc:signal", {
        from: socket.id,
        signal: payload.signal,
      });
    }
  );

  socket.on("disconnect", () => {
    if (!currentSpaceId || !currentUserId) return;
    const users = getSpace(currentSpaceId);
    users.delete(currentUserId);
    socket.to(currentSpaceId).emit("user:left", currentUserId);
    broadcastUsers(io, currentSpaceId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on http://localhost:${PORT}`);
});
