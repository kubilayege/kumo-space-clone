"use client";

import clsx from "clsx";
import {
  AUDIO_RANGE,
  DEFAULT_OFFICE,
  User,
  getInitials,
  getZoneAt,
} from "@/lib/types";

interface OfficeCanvasProps {
  users: User[];
  localUser: User;
  onMove: (x: number, y: number) => void;
}

export function OfficeCanvas({ users, localUser, onMove }: OfficeCanvasProps) {
  const scale = 0.82;
  const map = DEFAULT_OFFICE;

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    onMove(x, y);
  };

  return (
    <div className="relative h-full w-full overflow-auto rounded-3xl border border-white/10 bg-[#101018] p-4">
      <div
        className="relative mx-auto cursor-crosshair"
        style={{
          width: map.width * scale,
          height: map.height * scale,
        }}
      >
        <div
          className="relative origin-top-left rounded-[28px] border border-zinc-700/60 bg-[#15151d] shadow-inner"
          style={{
            width: map.width,
            height: map.height,
            transform: `scale(${scale})`,
          }}
          onClick={handleCanvasClick}
        >
          {map.zones.map((zone) => (
            <div
              key={zone.id}
              className="absolute rounded-3xl border border-black/5"
              style={{
                left: zone.x,
                top: zone.y,
                width: zone.width,
                height: zone.height,
                backgroundColor: zone.color,
              }}
            >
              <div className="absolute left-4 top-3 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {zone.name}
              </div>
              {zone.type === "meeting" && (
                <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-amber-300/50" />
              )}
              {zone.type === "focus" && (
                <div className="absolute inset-3 rounded-2xl bg-emerald-900/5 ring-1 ring-emerald-500/20" />
              )}
            </div>
          ))}

          <div
            className="pointer-events-none absolute rounded-full border border-indigo-400/20 bg-indigo-500/5"
            style={{
              left: localUser.x - AUDIO_RANGE,
              top: localUser.y - AUDIO_RANGE,
              width: AUDIO_RANGE * 2,
              height: AUDIO_RANGE * 2,
            }}
          />

          {users.map((user) => {
            const isLocal = user.id === localUser.id;
            const zone = getZoneAt(user.x, user.y, map);

            return (
              <div
                key={user.id}
                className={clsx(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform duration-150",
                  isLocal && "z-20"
                )}
                style={{ left: user.x, top: user.y }}
              >
                <div
                  className={clsx(
                    "relative flex h-14 w-14 items-center justify-center rounded-full border-4 text-sm font-semibold text-white shadow-lg",
                    isLocal && "pulse-ring"
                  )}
                  style={{
                    backgroundColor: user.color,
                    borderColor: isLocal ? "#ffffff" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {getInitials(user.name)}
                  <span
                    className={clsx(
                      "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#15151d]",
                      user.status === "available" && "bg-emerald-400",
                      user.status === "busy" && "bg-rose-400",
                      user.status === "away" && "bg-amber-400"
                    )}
                  />
                </div>
                <div className="mt-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  {user.name}
                  {isLocal ? " (you)" : ""}
                </div>
                {zone && isLocal && (
                  <div className="mt-1 text-[11px] text-indigo-200">{zone.name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
