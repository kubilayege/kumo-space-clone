"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  MessageCircle,
  Search,
  Users,
  Volume2,
} from "lucide-react";
import { AVATAR_COLORS } from "@/lib/types";

const FEATURES = [
  {
    icon: Volume2,
    title: "Proximity voice",
    text: "Walk over, talk softer as you walk away. Rooms hear you fully.",
  },
  {
    icon: Users,
    title: "Live presence",
    text: "See teammates move across the floor in real time.",
  },
  {
    icon: MessageCircle,
    title: "Layered chat",
    text: "Whisper nearby, message the floor, or broadcast to all.",
  },
];

const SOCIAL_PROOF = [
  "Remote standups",
  "Pair programming",
  "Virtual watercooler",
  "Design reviews",
  "Onboarding days",
];

// Mini-world thumbnail avatars (percentage positions, warm palette).
const PREVIEW_AVATARS = [
  { x: 20, y: 32, color: "var(--av-teal)", size: 14 },
  { x: 30, y: 28, color: "var(--av-gold)", size: 14 },
  { x: 68, y: 36, color: "var(--av-coral)", size: 16, me: true },
  { x: 76, y: 46, color: "var(--av-plum)", size: 14 },
  { x: 24, y: 76, color: "var(--av-sage)", size: 14 },
  { x: 64, y: 70, color: "var(--av-sky)", size: 14 },
];

const PREVIEW_BUBBLES = [
  { x: 30, y: 18, text: "Ready?", delay: 0 },
  { x: 66, y: 24, text: "two sec", delay: 1.2, mine: true },
  { x: 22, y: 62, text: "tea? ☕", delay: 2.4 },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("island-hq");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const params = new URLSearchParams({ name: name.trim(), color });
    router.push(
      `/space/${encodeURIComponent(spaceId.trim() || "island-hq")}?${params.toString()}`
    );
  };

  const initial = name.trim() ? name.trim().slice(0, 1).toUpperCase() : "A";

  return (
    <main className="relative h-[100dvh] w-screen overflow-y-auto bg-[var(--paper)] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 py-5 sm:px-6 sm:py-6 lg:h-full lg:min-h-0 lg:px-10">
        {/* Header */}
        <header
          className={`flex shrink-0 items-center justify-between ${mounted ? "hero-rise" : "opacity-0"}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--accent)] text-[15px] font-bold text-white">
              ◐
            </div>
            <div className="leading-tight">
              <p className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">Atrium</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)]">spatial workspace</p>
            </div>
          </div>

          <Link
            href="/space/demo?color=%23e25a3c&name=Demo+User"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--surface-2)] sm:text-sm"
          >
            Try demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-6 xl:gap-16">
          {/* Left: editorial intro + live world preview */}
          <div className="flex flex-col">
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--ink-soft)] sm:text-[12px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-ok)]" />
              No signup · jump straight in
            </div>

            <h1
              className={`mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--ink)] text-balance sm:mt-5 sm:text-[52px] lg:text-[60px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
              style={{ animationDelay: "0.1s" }}
            >
              Walk around.{" "}
              <span className="text-[var(--accent)]">Talk to whoever&apos;s near.</span>
            </h1>

            <p
              className={`mt-5 max-w-lg text-[15px] leading-7 text-[var(--ink-soft)] text-balance sm:text-[17px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
              style={{ animationDelay: "0.18s" }}
            >
              Drop your avatar onto a shared floor. Voice fades with distance, rooms keep
              conversations together, and a screen share is one click away.
            </p>

            <div
              className={`mt-6 sm:mt-8 ${mounted ? "hero-rise" : "opacity-0"}`}
              style={{ animationDelay: "0.26s" }}
            >
              <WorldPreview />
            </div>

            <div
              className={`mt-6 grid gap-2.5 sm:mt-7 sm:grid-cols-3 sm:gap-3 ${mounted ? "hero-rise" : "opacity-0"}`}
              style={{ animationDelay: "0.34s" }}
            >
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] sm:p-4"
                >
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                    <Icon className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-[var(--ink)] sm:text-sm">{title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)] sm:text-xs">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: onboarding-style join card */}
          <form
            onSubmit={handleJoin}
            className={`glass-strong relative self-start rounded-[20px] p-5 sm:p-7 lg:sticky lg:top-6 ${
              mounted ? "animate-scale-in" : "opacity-0"
            }`}
            style={{ animationDelay: "0.2s" }}
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
              Step in
            </p>
            <h2 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-[28px]">
              Who are you?
            </h2>
            <p className="mt-1.5 text-[12px] text-[var(--ink-soft)] sm:text-[13px]">
              This is how teammates will see you. Share the Space ID — same ID, same room.
            </p>

            {/* Avatar preview */}
            <div className="mt-6 flex items-center gap-5">
              <div
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-3xl font-bold text-white shadow-[0_0_0_4px_var(--paper),0_0_0_5px_var(--line-2),0_8px_20px_rgba(28,24,20,0.18)]"
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
                      onClick={() => setColor(option)}
                      className={`relative h-7 w-7 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                        color === option
                          ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]"
                          : ""
                      }`}
                      style={{ backgroundColor: option }}
                      aria-label={`Select color ${option}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Field label="Display name" value={name} onChange={setName} placeholder="Aylin" autoFocus />
              <Field
                label="Space ID"
                value={spaceId}
                onChange={setSpaceId}
                placeholder="island-hq"
                hint="letters, numbers, dashes — anything goes"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-[12px] text-[var(--ink-soft)]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <Check className="h-2.5 w-2.5 text-[var(--accent)]" strokeWidth={3} />
              </span>
              Visible to everyone in the space
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] px-4 py-3.5 text-[15px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_1px_2px_rgba(28,24,20,0.18)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--ink-ghost)] disabled:shadow-none"
            >
              Enter the space
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
                Teams use Atrium for
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SOCIAL_PROOF.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="vs-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring)]"
      />
      {hint && <span className="mt-1.5 block text-[11px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  );
}

function WorldPreview() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
      {/* window chrome */}
      <div className="flex h-[38px] items-center gap-2 border-b border-[var(--line)] bg-[var(--paper-2)] px-3.5">
        <span className="chrome-dot r" />
        <span className="chrome-dot y" />
        <span className="chrome-dot g" />
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-ok)]" />
          Live · 12 here now
        </span>
        <span className="hidden items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)] sm:flex">
          <Search className="h-3 w-3" /> Find a room
        </span>
      </div>

      {/* floor */}
      <div className="relative aspect-[16/9] floor-pattern">
        {/* rooms */}
        <div className="absolute left-[6%] top-[10%] h-[42%] w-[30%] rounded-[4px] border-[1.5px] border-[var(--wall-2)] bg-[var(--room)]">
          <span className="absolute left-2.5 top-1.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-[var(--ink-2)] sm:text-[9px]">
            Design
          </span>
        </div>
        <div className="absolute left-[6%] top-[56%] h-[34%] w-[30%] rounded-[4px] border-[1.5px] border-[var(--wall-2)] bg-[var(--room-warm)]">
          <span className="absolute left-2.5 top-1.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-[var(--ink-2)] sm:text-[9px]">
            Eng
          </span>
        </div>
        <div className="absolute left-[54%] top-[10%] h-[44%] w-[40%] rounded-[4px] border-[1.5px] border-[var(--wall-2)] bg-[var(--room)]">
          <span className="absolute left-2.5 top-1.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-[var(--ink-2)] sm:text-[9px]">
            Lounge
          </span>
        </div>
        <div className="absolute left-[54%] top-[62%] h-[28%] w-[18%] rounded-[4px] border-[1.5px] border-[var(--wall-2)] bg-[var(--room-warm)]" />
        <div className="absolute left-[76%] top-[62%] h-[28%] w-[18%] rounded-[4px] border-[1.5px] border-[var(--wall-2)] bg-[var(--room)]" />

        {/* proximity ring around me */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: "68%",
            top: "36%",
            width: "26%",
            height: "46%",
            border: "1.5px dashed var(--accent)",
            background: "radial-gradient(circle, var(--accent-ring) 0%, transparent 70%)",
          }}
        />

        {/* avatars */}
        {PREVIEW_AVATARS.map((a, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 drift"
            style={{ left: `${a.x}%`, top: `${a.y}%`, animationDelay: `${i * 0.5}s` }}
          >
            <div
              className="rounded-full border-2 border-white shadow-[0_2px_6px_rgba(28,24,20,0.18)]"
              style={{
                width: a.size,
                height: a.size,
                backgroundColor: a.color,
                boxShadow: a.me ? "0 0 0 3px var(--accent-ring)" : undefined,
              }}
            />
          </div>
        ))}

        {/* speech bubbles */}
        {PREVIEW_BUBBLES.map((b, i) => (
          <div
            key={i}
            className="chat-bubble-float pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.delay}s` }}
          >
            <div
              className={`rounded-[10px] border px-2 py-0.5 text-[9px] font-medium shadow-[var(--shadow-md)] sm:text-[10px] ${
                b.mine
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink)]"
              }`}
            >
              {b.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2 text-[11px] text-[var(--ink-soft)]">
        <span className="flex items-center gap-1">
          <span className="vs-kbd">W</span>
          <span className="vs-kbd">A</span>
          <span className="vs-kbd">S</span>
          <span className="vs-kbd">D</span>
          <span className="ml-1">or click to walk</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-faint)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-ok)]" />
          ISLAND HQ
        </span>
      </div>
    </div>
  );
}
