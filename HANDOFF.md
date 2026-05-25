# Handoff — Kumo Space Clone

## Goal

Kumospace-inspired virtual office: avatar movement on a shared floor, spatial audio/video for nearby users, room zones, and real-time chat. Built for remote testing with a friend via public deployment.

## Current State

**Production is live and usable.** Frontend on Vercel, realtime server on Render. WebRTC signaling bug (no offer sent) was fixed in commit `2420971`; redeployed to Vercel.

| Service | URL |
|---------|-----|
| App | https://kumo-space-clone.vercel.app |
| Socket server | https://kumo-space-socket.onrender.com |
| GitHub | https://github.com/kubilayege/kumo-space-clone |
| Vercel project | `kkks-projects-e06fe331/kumo-space-clone` |
| Render service | `kumo-space-socket` (`srv-d8a6vfh9rddc739rrkm0`) |

## Commits

1. `7906822` — Initial app: Next.js frontend, Socket.io server, office canvas, chat, WebRTC scaffold
2. `2420971` — Fix WebRTC: deterministic offer initiation, ICE queue, TURN relay, media playback

See `README.md` for local dev and feature overview.

## Architecture

```
Browser (Vercel)                    Render (Node)
┌─────────────────────┐          ┌──────────────────────┐
│ Next.js 15 App      │  WS      │ server/index.ts      │
│ - landing / join    │◄────────►│ Socket.io            │
│ - SpaceRoom         │          │ in-memory spaces     │
│ - OfficeCanvas      │          │ chat relay           │
│ - WebRTCManager     │  signal  │ webrtc:signal relay  │
└─────────────────────┘◄────────►└──────────────────────┘
         │ peer-to-peer WebRTC (STUN + TURN)
         └──────────────────────────────────────────────► other browser
```

**Why two hosts:** Vercel cannot run persistent WebSocket/WebRTC signaling. Socket.io lives on Render free tier.

## Environment

| Variable | Where | Value |
|----------|-------|-------|
| `NEXT_PUBLIC_SOCKET_URL` | Vercel (production) | `https://kumo-space-socket.onrender.com` |
| `ALLOWED_ORIGINS` | Render | `https://kumo-space-clone.vercel.app,http://localhost:3000` |
| `NODE_ENV` | Render | `production` |

Local: copy `.env.example` → `.env.local`.

## Key Files

| Path | Role |
|------|------|
| `src/app/page.tsx` | Landing / join form |
| `src/app/space/[id]/page.tsx` | Space route |
| `src/components/SpaceRoom.tsx` | Socket lifecycle, movement, media toggles, WebRTC sync |
| `src/components/OfficeCanvas.tsx` | 2D floor, zones, avatars |
| `src/components/VideoGrid.tsx` | Local/remote tiles, spatial volume |
| `src/components/ChatPanel.tsx` | Nearby / Floor / All chat |
| `src/lib/webrtc.ts` | WebRTC peer mesh, signaling, TURN |
| `src/lib/socket.ts` | Socket.io client |
| `src/lib/types.ts` | Shared types, office map, constants (`AUDIO_RANGE=180`) |
| `server/index.ts` | Socket.io server, presence, chat, signal relay |
| `render.yaml` | Render blueprint |

## Recent Bugfix (WebRTC)

**Symptom:** User reported audio/video not reaching the other party (`ses ve goruntu karsi tarafa gitmiyor`).

**Root cause:** `syncPeers()` created peer connections with `initiator: false` for both sides — nobody sent SDP offers.

**Fix in `src/lib/webrtc.ts`:**
- Lower socket ID initiates offer (`localeCompare`)
- ICE candidates queued until remote description is set
- TURN added (`openrelay.metered.ca`) for cross-NAT
- Rollback handling for offer glare
- `VideoGrid`: explicit `play()` for audio/video elements

## Known Limitations

- **Render free tier** sleeps after ~15 min idle; first join may take ~30s to wake
- **In-memory state** on socket server — spaces/chat reset on restart/redeploy
- **No TURN auth of your own** — uses public OpenRelay (fine for testing, not production-grade)
- **Mesh WebRTC** — scales poorly beyond a few nearby peers
- **Spatial audio** is volume attenuation on `<audio>`, not true Web Audio API spatialization
- **Browser autoplay** — user may need a click before remote audio plays
- **Users must be within `AUDIO_RANGE` (180px)** and enable mic/camera for media

## Local Dev

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Socket: http://localhost:3001

Test with two tabs, same space ID, walk avatars together, enable mic/camera.

## Deploy

**Frontend (Vercel):**
```bash
vercel deploy --prod --yes
```

**Socket server (Render):** auto-deploys on push to `main` if connected to GitHub repo. Manual:
```bash
render services create ...  # already exists
git push origin main
```

**After changing socket URL:** update `NEXT_PUBLIC_SOCKET_URL` on Vercel and redeploy.

**Git push:** use `gh auth setup-git` if HTTPS credentials fail.

## Testing Checklist

1. Hard refresh production (`Cmd+Shift+R`)
2. Same Space ID for both users (e.g. `main-office`)
3. Enable mic + camera (grant browser permissions)
4. Move avatars within purple audio ring / ~180px
5. Verify video tile appears for remote user
6. Floor chat should work regardless of proximity

## Suggested Next Work

Priority if media still flaky:
- Add connection status UI (WebRTC `connectionState` per peer)
- Verify TURN relay under strict corporate NAT
- Replace public TURN with Metered/Twilio credentials

Product gaps vs real Kumospace:
- Multiple floors
- Screen share / present
- Persistent chat and spaces (DB)
- Private room doors / zone audio dampening
- User auth and invite links

Infra hardening:
- Upgrade Render plan or move socket server to Railway/Fly for always-on
- Add health monitoring for socket server wake-up

## Accounts & Access

- **Vercel:** logged in as `kubilayjg`
- **Render:** workspace `euqns's workspace` (`tea-d8a6sfjeo5us739ff1q0`), user `euqns`
- **GitHub:** `kubilayege` — repo `kumo-space-clone`

Next agent needs Vercel/Render dashboard access or CLI auth (`vercel whoami`, `render whoami`, `gh auth status`).

## Skills for Next Session

| Task | Skill |
|------|-------|
| WebRTC/media still broken | `diagnose` |
| Architecture cleanup | `improve-codebase-architecture` |
| New features with tests | `tdd` |
| UI design exploration | `prototype` |
| PR merge / CI issues | `babysit` |
