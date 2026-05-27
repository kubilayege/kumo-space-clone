"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  Clock,
  Mic,
  MicOff,
  Plus,
} from "lucide-react";
import { AVATAR_COLORS, DEFAULT_OFFICE } from "@/lib/types";

const RECENT_KEY = "atrium-recent-spaces";

interface RecentSpace {
  id: string;
  lastSeen: number;
}

const SPAWNS = [
  {
    id: "open",
    name: "Open floor",
    hint: "Land in the middle of everything",
    x: DEFAULT_OFFICE.width / 2,
    y: DEFAULT_OFFICE.height / 2,
  },
  ...DEFAULT_OFFICE.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    hint:
      zone.type === "meeting"
        ? "Quiet, room audio"
        : zone.type === "focus"
          ? "Heads-down pod"
          : zone.type === "lounge"
            ? "Casual hangout"
            : "Shared desks",
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
  })),
];

const STEPS = ["Identity", "Mic & camera", "Pick a spawn"] as const;

function loadRecent(): RecentSpace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as RecentSpace[])
      .filter((s) => s && typeof s.id === "string")
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function rememberSpace(id: string) {
  if (typeof window === "undefined") return;
  const existing = loadRecent().filter((s) => s.id !== id);
  const next = [{ id, lastSeen: Date.now() }, ...existing].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("island-hq");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [wantMic, setWantMic] = useState(false);
  const [wantCam, setWantCam] = useState(false);
  const [spawn, setSpawn] = useState(SPAWNS[0]);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSpace[]>([]);
  const [mounted, setMounted] = useState(false);

  const previewRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
    setRecent(loadRecent());
  }, []);

  const stopPreview = () => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  // Reacquire a preview stream whenever mic/camera intent changes on step 2.
  useEffect(() => {
    if (step !== 1) {
      stopPreview();
      return;
    }
    let cancelled = false;
    setMediaNote(null);
    stopPreview();
    if (!wantMic && !wantCam) return;

    navigator.mediaDevices
      .getUserMedia({ audio: wantMic, video: wantCam })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (wantCam && previewRef.current) {
          previewRef.current.srcObject = stream;
          void previewRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMediaNote(
          "Couldn't access your devices. You can still continue and enable them later."
        );
        setWantMic(false);
        setWantCam(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, wantMic, wantCam]);

  useEffect(() => () => stopPreview(), []);

  const initial = name.trim() ? name.trim().slice(0, 1).toUpperCase() : "A";
  const canContinue = step === 0 ? name.trim().length > 0 : true;

  const enterSpace = () => {
    if (!name.trim()) return;
    stopPreview();
    const id = spaceId.trim() || "island-hq";
    rememberSpace(id);
    const params = new URLSearchParams({
      name: name.trim(),
      color,
      x: String(Math.round(spawn.x)),
      y: String(Math.round(spawn.y)),
    });
    if (wantMic) params.set("mic", "1");
    if (wantCam) params.set("cam", "1");
    router.push(`/space/${encodeURIComponent(id)}?${params.toString()}`);
  };

  const handleNext = () => {
    if (!canContinue) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else enterSpace();
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-y-auto bg-[var(--paper)] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-5 sm:px-6 sm:py-6 lg:h-full lg:min-h-0 lg:px-10">
        <header className={`flex shrink-0 items-center justify-between ${mounted ? "hero-rise" : "opacity-0"}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--accent)] text-[15px] font-bold text-white">
              ◐
            </div>
            <div className="leading-tight">
              <p className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">Atrium</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)]">spatial workspace</p>
            </div>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[300px_1fr] lg:gap-12 lg:py-6">
          {/* Recent spaces rail (4-A) */}
          <aside className={`flex flex-col gap-3 ${mounted ? "hero-rise" : "opacity-0"}`}>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
              Your spaces
            </p>
            <div className="flex flex-col gap-2">
              {recent.length === 0 && (
                <p className="rounded-[12px] border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-3 text-[12px] text-[var(--ink-faint)]">
                  Spaces you join show up here.
                </p>
              )}
              {recent.map((space) => {
                const active = space.id === spaceId.trim();
                return (
                  <button
                    key={space.id}
                    onClick={() => setSpaceId(space.id)}
                    className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] text-[13px] font-bold uppercase text-white"
                      style={{ backgroundColor: AVATAR_COLORS[hashIndex(space.id)] }}
                    >
                      {space.id.replace(/[^a-z0-9]/gi, "").slice(0, 2) || "··"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                        {space.id}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--ink-faint)]">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(space.lastSeen)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-2 block">
              <span className="vs-label">Space ID</span>
              <div className="flex items-center gap-2 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-2 py-1.5">
                <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
                <input
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                  placeholder="new-or-existing"
                  className="w-full bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                />
              </div>
            </label>
          </aside>

          {/* Onboarding stepper (3-A) */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleNext();
            }}
            className={`glass-strong self-start rounded-[20px] p-5 sm:p-7 ${mounted ? "animate-scale-in" : "opacity-0"}`}
          >
            {/* progress */}
            <div className="mb-7 flex items-center gap-2">
              {STEPS.map((label, index) => {
                const done = index < step;
                const current = index === step;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold ${
                          current
                            ? "bg-[var(--accent)] text-white"
                            : done
                              ? "bg-[var(--ink)] text-white"
                              : "border-[1.5px] border-[var(--line-2)] text-[var(--ink-faint)]"
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                      </span>
                      <span
                        className={`text-[12px] ${current ? "font-medium text-[var(--ink)]" : "text-[var(--ink-faint)]"}`}
                      >
                        {label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <span className="h-px w-4 bg-[var(--line-2)]" />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Step {step + 1} / {STEPS.length}
            </p>

            {step === 0 && (
              <StepIdentity
                name={name}
                onName={setName}
                color={color}
                onColor={setColor}
                initial={initial}
              />
            )}
            {step === 1 && (
              <StepMedia
                wantMic={wantMic}
                wantCam={wantCam}
                onToggleMic={() => setWantMic((v) => !v)}
                onToggleCam={() => setWantCam((v) => !v)}
                previewRef={previewRef}
                note={mediaNote}
              />
            )}
            {step === 2 && <StepSpawn spawn={spawn} onSelect={setSpawn} />}

            {/* footer */}
            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--paper-2)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={!canContinue}
                className="flex items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 py-3 text-[15px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_1px_2px_rgba(28,24,20,0.18)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--ink-ghost)] disabled:shadow-none"
              >
                {step < STEPS.length - 1 ? "Continue" : "Enter the space"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function StepIdentity({
  name,
  onName,
  color,
  onColor,
  initial,
}: {
  name: string;
  onName: (v: string) => void;
  color: string;
  onColor: (v: string) => void;
  initial: string;
}) {
  return (
    <>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        Who are you?
      </h1>
      <p className="mt-1.5 max-w-md text-[14px] text-[var(--ink-soft)]">
        This is how teammates will see you in the space. You can change it anytime.
      </p>

      <div className="mt-6 flex items-center gap-5">
        <div
          className="flex h-[80px] w-[80px] items-center justify-center rounded-full text-3xl font-bold text-white shadow-[0_0_0_4px_var(--paper),0_0_0_5px_var(--line-2),0_8px_20px_rgba(28,24,20,0.18)]"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
        <div>
          <label className="vs-label">Avatar color</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onColor(option)}
                className={`h-7 w-7 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                  color === option ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]" : ""
                }`}
                style={{ backgroundColor: option }}
                aria-label={`Select color ${option}`}
              />
            ))}
          </div>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="vs-label">Display name</span>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Aylin"
          autoFocus
          className="w-full rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring)]"
        />
      </label>
    </>
  );
}

function StepMedia({
  wantMic,
  wantCam,
  onToggleMic,
  onToggleCam,
  previewRef,
  note,
}: {
  wantMic: boolean;
  wantCam: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  previewRef: React.RefObject<HTMLVideoElement | null>;
  note: string | null;
}) {
  return (
    <>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        Mic &amp; camera
      </h1>
      <p className="mt-1.5 max-w-md text-[14px] text-[var(--ink-soft)]">
        Turn on what you want when you arrive. You can toggle both anytime in the space.
      </p>

      <div className="mt-6 flex items-center justify-center overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-[var(--paper-2)]" style={{ aspectRatio: "16 / 9" }}>
        {wantCam ? (
          <video ref={previewRef} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-[var(--ink-faint)]">
            <CameraOff className="h-7 w-7" />
            <span className="text-[12px]">Camera off</span>
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DeviceToggle on={wantMic} onClick={onToggleMic} onIcon={Mic} offIcon={MicOff} label="Microphone" />
        <DeviceToggle on={wantCam} onClick={onToggleCam} onIcon={Camera} offIcon={CameraOff} label="Camera" />
      </div>

      {note && <p className="mt-3 text-[12px] text-[var(--accent-hover)]">{note}</p>}
    </>
  );
}

function DeviceToggle({
  on,
  onClick,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  onIcon: typeof Mic;
  offIcon: typeof MicOff;
  label: string;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition ${
        on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          on ? "bg-[var(--accent)] text-white" : "bg-[var(--paper-2)] text-[var(--ink-soft)]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-[var(--ink)]">{label}</span>
        <span className="block text-[11px] text-[var(--ink-faint)]">{on ? "On" : "Off"}</span>
      </span>
    </button>
  );
}

function StepSpawn({
  spawn,
  onSelect,
}: {
  spawn: (typeof SPAWNS)[number];
  onSelect: (s: (typeof SPAWNS)[number]) => void;
}) {
  const scale = Math.min(300 / DEFAULT_OFFICE.width, 150 / DEFAULT_OFFICE.height);
  return (
    <>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        Pick a spawn
      </h1>
      <p className="mt-1.5 max-w-md text-[14px] text-[var(--ink-soft)]">
        Choose where you land on the floor. Walk anywhere once you&apos;re in.
      </p>

      {/* mini map with selectable rooms */}
      <div
        className="relative mx-auto mt-6 overflow-hidden rounded-[10px] border border-[var(--line-2)] bg-[var(--floor)]"
        style={{ width: DEFAULT_OFFICE.width * scale, height: DEFAULT_OFFICE.height * scale }}
      >
        {DEFAULT_OFFICE.zones.map((zone) => {
          const active = spawn.id === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() =>
                onSelect(SPAWNS.find((s) => s.id === zone.id) ?? SPAWNS[0])
              }
              className="absolute rounded-[2px] border transition"
              style={{
                left: zone.x * scale,
                top: zone.y * scale,
                width: zone.width * scale,
                height: zone.height * scale,
                background:
                  zone.type === "meeting" || zone.type === "focus"
                    ? "var(--room-warm)"
                    : "var(--room)",
                borderColor: active ? "var(--accent)" : "var(--wall-2)",
                boxShadow: active ? "0 0 0 2px var(--accent-ring)" : undefined,
              }}
              title={zone.name}
            />
          );
        })}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: spawn.x * scale,
            top: spawn.y * scale,
            width: 12,
            height: 12,
            background: "var(--accent)",
            boxShadow: "0 0 0 3px var(--accent-ring)",
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SPAWNS.map((option) => {
          const active = spawn.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              }`}
              title={option.hint}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

function hashIndex(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % AVATAR_COLORS.length;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
