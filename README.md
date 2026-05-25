# Kumo Space Clone

A Kumospace-inspired virtual office with avatar movement, spatial audio/video, room zones, and real-time chat.

## Features

- Shared virtual floor with open workspace, meeting rooms, focus pods, lounge, and more
- Real-time multiplayer presence over WebSockets
- Avatar movement with WASD / arrow keys or click-to-move
- Proximity-based video and spatial audio volume
- Status indicators: Available, Busy, Away
- Chat scopes: Nearby, Floor, All Floors
- WebRTC peer connections for nearby teammates

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

This runs:
- Next.js frontend at [http://localhost:3000](http://localhost:3000)
- Socket.io server at [http://localhost:3001](http://localhost:3001)

3. Open the app in two browser tabs, join the same space ID, and walk your avatars near each other to test spatial conversations.

## Controls

- `WASD` or arrow keys: move avatar
- Click the floor: walk to location
- Mic / camera buttons: enable media and connect to nearby users
- Chat panel: send Nearby, Floor, or All Floors messages
- Status pills: set availability

## Tech Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS 4
- Socket.io for presence and chat
- WebRTC for nearby audio/video

## Notes

- Spaces are in-memory and reset when the socket server restarts
- Camera/mic permissions are requested only when you enable them
- For production, deploy the socket server separately and set `NEXT_PUBLIC_SOCKET_URL`
