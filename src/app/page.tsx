"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  Sparkles,
  Users,
  Volume2,
  Zap,
  Globe,
  Headphones,
} from "lucide-react";
import { AVATAR_COLORS } from "@/lib/types";

const FEATURES = [
  {
    icon: Volume2,
    title: "Spatial audio",
    text: "Walk over, talk softer as you walk away. Just like real life.",
  },
  {
    icon: Users,
    title: "Live presence",
    text: "See teammates move across the floor in real-time.",
  },
  {
    icon: MessageCircle,
    title: "Layered chat",
    text: "Whisper to nearby, broadcast to the floor, or message all.",
  },
];

const STATS = [
  { icon: Headphones, label: "Spatial audio" },
  { icon: Zap, label: "Real-time" },
  { icon: Globe, label: "No install" },
];

const SOCIAL_PROOF = [
  "Remote standups",
  "Pair programming",
  "Virtual watercooler",
  "Distributed hiring",
  "Design reviews",
  "Onboarding days",
];

const PREVIEW_AVATARS = [
  { x: 18, y: 28, color: "#6366f1", name: "Alex", delay: 0, speaking: true },
  { x: 28, y: 42, color: "#818cf8", name: "Sam", delay: 0.4 },
  { x: 42, y: 24, color: "#ec4899", name: "Jordan", delay: 0.8 },
  { x: 52, y: 38, color: "#22c55e", name: "Riley", delay: 1.2 },
  { x: 68, y: 22, color: "#f97316", name: "Casey", delay: 1.6 },
  { x: 78, y: 48, color: "#06b6d4", name: "Morgan", delay: 2 },
  { x: 22, y: 72, color: "#a855f7", name: "Taylor", delay: 2.4 },
  { x: 62, y: 78, color: "#eab308", name: "Quinn", delay: 2.8 },
];

const CHAT_BUBBLES = [
  { x: 14, y: 18, text: "hey!", delay: 0 },
  { x: 48, y: 14, text: "lgtm ✓", delay: 1.2 },
  { x: 74, y: 38, text: "brb", delay: 2.4 },
  { x: 28, y: 58, text: "sync?", delay: 0.8 },
];

const FURNITURE = [
  { x: 10, y: 16, w: 14, h: 8, type: "desk" as const },
  { x: 38, y: 14, w: 12, h: 7, type: "desk" as const },
  { x: 66, y: 18, w: 16, h: 9, type: "desk" as const },
  { x: 14, y: 68, w: 18, h: 10, type: "sofa" as const },
  { x: 58, y: 70, w: 14, h: 8, type: "desk" as const },
  { x: 44, y: 52, w: 6, h: 6, type: "plant" as const },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("main-office");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [mounted, setMounted] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [rippleKey, setRippleKey] = useState(0);
  const [rippleColor, setRippleColor] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMouse({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }, []);

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const params = new URLSearchParams({
      name: name.trim(),
      color,
    });

    router.push(`/space/${encodeURIComponent(spaceId.trim() || "main-office")}?${params.toString()}`);
  };

  const handleColorSelect = (option: string) => {
    setColor(option);
    setRippleColor(option);
    setRippleKey((k) => k + 1);
  };

  const blobOffset = (factor: number) => ({
    transform: `translate(${(mouse.x - 0.5) * factor}px, ${(mouse.y - 0.5) * factor}px)`,
  });

  return (
    <main
      className="relative min-h-[100dvh] w-screen overflow-x-hidden overflow-y-auto bg-[#07070d] lg:h-screen lg:overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="blob absolute -left-32 top-1/4 h-[520px] w-[520px] bg-indigo-600/25 blur-3xl transition-transform duration-700 ease-out"
          style={blobOffset(-48)}
        />
        <div
          className="blob absolute -right-24 top-8 h-[460px] w-[460px] bg-violet-600/22 blur-3xl transition-transform duration-700 ease-out"
          style={{ ...blobOffset(36), animationDelay: "-6s" }}
        />
        <div
          className="blob absolute bottom-[-80px] left-1/4 h-[420px] w-[420px] bg-fuchsia-600/12 blur-3xl transition-transform duration-700 ease-out"
          style={{ ...blobOffset(-28), animationDelay: "-12s" }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-3xl transition-transform duration-1000 ease-out"
          style={blobOffset(20)}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 py-5 sm:px-6 sm:py-6 lg:h-full lg:min-h-0 lg:px-10">
        <header
          className={`flex shrink-0 items-center justify-between ${mounted ? "hero-rise" : "opacity-0"}`}
          style={{ animationDelay: "0.05s" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
              <span className="relative text-sm font-bold text-white">K</span>
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight text-white">Kumo Space</p>
              <p className="text-[11px] text-zinc-500">virtual office, spatial audio</p>
            </div>
          </div>

          <Link
            href="/space/demo?color=%236366f1&name=Demo+User"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:px-4 sm:text-sm"
          >
            Try demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-[1.05fr_0.92fr] lg:gap-14 lg:py-6 xl:gap-16">
          <div className="flex flex-col">
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200 backdrop-blur-sm sm:text-[12px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
              style={{ animationDelay: "0.12s" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Now in beta · No signup
            </div>

            <h1
              className={`mt-4 text-[38px] font-bold leading-[1.02] tracking-[-0.03em] text-white text-balance sm:mt-5 sm:text-[48px] md:text-[58px] lg:text-[62px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
              style={{ animationDelay: "0.2s" }}
            >
              The office, but{" "}
              <span className="hero-gradient-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                wherever
              </span>{" "}
              you are.
            </h1>

            <div
              className={`mt-5 flex flex-wrap gap-2 sm:mt-6 ${mounted ? "" : "opacity-0"}`}
            >
              {STATS.map(({ icon: Icon, label }, index) => (
                <span
                  key={label}
                  className="stat-fade inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-300 sm:text-[12px]"
                  style={{ animationDelay: `${0.32 + index * 0.08}s` }}
                >
                  <Icon className="h-3 w-3 shrink-0 text-indigo-400" />
                  {label}
                </span>
              ))}
            </div>

            <p
              className={`mt-5 max-w-lg text-[15px] leading-7 text-zinc-400 text-balance sm:text-[17px] ${
                mounted ? "hero-rise" : "opacity-0"
              }`}
              style={{ animationDelay: "0.38s" }}
            >
              Drop your avatar into a shared floor. Walk up to teammates to start talking — voice fades as you walk away. Hang out, work, and ship together.
            </p>

            <div
              className={`mt-6 sm:mt-8 ${mounted ? "hero-rise" : "opacity-0"}`}
              style={{ animationDelay: "0.46s" }}
            >
              <OfficePreview compact={false} />
            </div>

            <div
              className={`mt-6 sm:mt-8 ${mounted ? "hero-rise" : "opacity-0"}`}
              style={{ animationDelay: "0.54s" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Teams use Kumo Space for
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SOCIAL_PROOF.map((item, index) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400 transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.06] hover:text-zinc-200 sm:text-[12px]"
                    style={{ animationDelay: `${0.58 + index * 0.04}s` }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div
              className={`mt-6 grid gap-2.5 sm:mt-8 sm:grid-cols-3 sm:gap-3 ${mounted ? "hero-rise" : "opacity-0"}`}
              style={{ animationDelay: "0.62s" }}
            >
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.04] sm:p-4"
                >
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 transition group-hover:bg-indigo-500/20">
                    <Icon className="h-4 w-4 text-indigo-300" />
                  </div>
                  <h3 className="text-[13px] font-medium text-white sm:text-sm">{title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500 sm:text-xs">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleJoin}
            className={`glass-strong relative self-start rounded-3xl p-5 shadow-[0_40px_80px_-20px_rgba(99,102,241,0.35)] sm:p-7 lg:sticky lg:top-6 ${
              mounted ? "animate-scale-in" : "opacity-0"
            }`}
            style={{ animationDelay: "0.25s" }}
          >
            <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/25 via-transparent to-fuchsia-500/15 opacity-60" />
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl transition-transform duration-700"
              style={blobOffset(12)}
            />

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300/80">
                Step in
              </p>
              <h2 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-white sm:text-[26px]">
                Join a space
              </h2>
              <p className="mt-1.5 text-[12px] text-zinc-400 sm:text-[13px]">
                Share the Space ID with anyone — same ID, same room.
              </p>

              <div className="mt-6 space-y-4 sm:mt-7">
                <Field
                  label="Your name"
                  value={name}
                  onChange={setName}
                  placeholder="Alex Morgan"
                  autoFocus
                />
                <Field
                  label="Space ID"
                  value={spaceId}
                  onChange={setSpaceId}
                  placeholder="main-office"
                  hint="letters, numbers, dashes — anything goes"
                />

                <div>
                  <label className="block text-[12px] font-medium text-zinc-300">
                    Avatar color
                  </label>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {AVATAR_COLORS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleColorSelect(option)}
                        className={`relative h-9 w-9 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                          color === option ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0b0b14]" : ""
                        }`}
                        style={{ backgroundColor: option }}
                        aria-label={`Select color ${option}`}
                      >
                        {rippleColor === option && (
                          <span
                            key={rippleKey}
                            className="color-ripple absolute inset-0 rounded-full"
                            style={{ backgroundColor: option }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3.5 text-[15px] font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:shadow-none sm:mt-7"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition-opacity group-enabled:group-hover:opacity-100" />
                <span className="relative">Enter space</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
              </button>

              <p className="mt-4 text-center text-[11px] text-zinc-500">
                By joining you agree to act like a human in a real office.
              </p>
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
  const [focused, setFocused] = useState(false);

  return (
    <label className="group/field block">
      <span className="block text-[12px] font-medium text-zinc-300">{label}</span>
      <div
        className={`relative mt-1.5 rounded-xl transition-shadow duration-300 ${
          focused ? "shadow-[0_0_24px_4px_rgba(99,102,241,0.15)]" : ""
        }`}
      >
        <div
          className={`pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-indigo-500/40 via-violet-500/30 to-fuchsia-500/20 transition-opacity duration-300 ${
            focused ? "opacity-100" : "opacity-0"
          }`}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="input-glow relative w-full rounded-xl border border-white/10 bg-[#0a0a14]/90 px-3.5 py-2.5 text-[14px] text-white placeholder:text-zinc-600 transition focus:border-indigo-400/60 focus:bg-[#0a0a14]"
        />
      </div>
      {hint && <span className="mt-1.5 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function OfficePreview({ compact }: { compact: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0e0e18] to-[#0a0a14] p-2.5 shadow-2xl shadow-black/50 sm:rounded-3xl sm:p-3">
      <div className="absolute left-3.5 top-3 z-10 flex items-center gap-1.5 sm:left-4 sm:top-3.5">
        <span className="h-2 w-2 rounded-full bg-rose-400/70 sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70 sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70 sm:h-2.5 sm:w-2.5" />
      </div>
      <div className="absolute right-3.5 top-3 z-10 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium text-zinc-400 sm:right-4 sm:top-3.5 sm:text-[10px]">
        main-office · 8 online
      </div>

      <div
        className={`relative mt-6 overflow-hidden rounded-xl floor-pattern sm:mt-7 sm:rounded-2xl ${
          compact ? "aspect-[2/1]" : "aspect-[16/10] sm:aspect-[16/9]"
        }`}
      >
        <div className="absolute left-[6%] top-[12%] h-[42%] w-[44%] rounded-xl border border-white/5 bg-indigo-500/[0.06] sm:rounded-2xl">
          <span className="absolute left-2 top-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-white/70 sm:left-3 sm:top-2 sm:px-2 sm:text-[9px]">
            Workspace
          </span>
          <div className="absolute bottom-2 left-3 h-1 w-8 rounded bg-white/[0.06] sm:bottom-3 sm:w-10" />
          <div className="absolute bottom-2 left-3 h-3 w-6 rounded-t border border-white/[0.08] bg-white/[0.04] sm:bottom-3 sm:h-4 sm:w-8" />
        </div>
        <div className="absolute right-[6%] top-[12%] h-[34%] w-[40%] rounded-xl border border-white/5 bg-amber-500/[0.07] sm:rounded-2xl">
          <span className="absolute left-2 top-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-white/70 sm:left-3 sm:top-2 sm:px-2 sm:text-[9px]">
            Meeting
          </span>
          <div className="absolute bottom-3 left-1/2 h-2 w-[60%] -translate-x-1/2 rounded-full bg-white/[0.05]" />
        </div>
        <div className="absolute bottom-[8%] left-[6%] h-[34%] w-[44%] rounded-xl border border-white/5 bg-fuchsia-500/[0.06] sm:rounded-2xl">
          <span className="absolute left-2 top-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-white/70 sm:left-3 sm:top-2 sm:px-2 sm:text-[9px]">
            Lounge
          </span>
          <div className="absolute bottom-3 left-4 h-2 w-12 rounded-full bg-white/[0.06]" />
          <div className="absolute bottom-3 right-4 h-2 w-12 rounded-full bg-white/[0.06]" />
        </div>
        <div className="absolute bottom-[8%] right-[6%] h-[34%] w-[40%] rounded-xl border border-white/5 bg-emerald-500/[0.06] sm:rounded-2xl">
          <span className="absolute left-2 top-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-white/70 sm:left-3 sm:top-2 sm:px-2 sm:text-[9px]">
            Focus
          </span>
        </div>

        {FURNITURE.map((item, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.w}%`,
              height: `${item.h}%`,
            }}
          >
            {item.type === "desk" && (
              <div className="h-full w-full rounded border border-white/[0.06] bg-white/[0.04]">
                <div className="absolute left-1/2 top-1/2 h-[40%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-indigo-400/20 bg-indigo-500/10" />
              </div>
            )}
            {item.type === "sofa" && (
              <div className="h-full w-full rounded-lg border border-white/[0.06] bg-fuchsia-500/[0.08]" />
            )}
            {item.type === "plant" && (
              <div className="flex h-full w-full items-end justify-center">
                <div className="h-[70%] w-[50%] rounded-full bg-emerald-500/20" />
                <div className="absolute bottom-0 h-[30%] w-[20%] rounded-sm bg-amber-700/30" />
              </div>
            )}
          </div>
        ))}

        {CHAT_BUBBLES.map((bubble, index) => (
          <div
            key={index}
            className="chat-bubble-float pointer-events-none absolute z-20"
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              animationDelay: `${bubble.delay}s`,
            }}
          >
            <div className="relative rounded-lg border border-white/10 bg-[#181826]/95 px-1.5 py-0.5 text-[8px] font-medium text-zinc-200 shadow-lg backdrop-blur-sm sm:px-2 sm:py-1 sm:text-[9px]">
              {bubble.text}
              <div className="absolute -bottom-1 left-2 h-2 w-2 rotate-45 border-b border-r border-white/10 bg-[#181826]/95" />
            </div>
          </div>
        ))}

        {PREVIEW_AVATARS.map((avatar, index) => (
          <div
            key={index}
            className="absolute z-10 drift"
            style={{
              left: `${avatar.x}%`,
              top: `${avatar.y}%`,
              animationDelay: `${avatar.delay}s`,
            }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              {avatar.speaking && (
                <div className="absolute -inset-3 rounded-full border border-indigo-400/30 bg-indigo-400/[0.06] speak-pulse" />
              )}
              <div
                className={`h-3 w-3 rounded-full ring-2 ring-white/30 shadow-lg sm:h-3.5 sm:w-3.5 ${
                  avatar.speaking ? "speak-pulse" : ""
                }`}
                style={{ backgroundColor: avatar.color }}
              />
              <span className="absolute left-1/2 top-full mt-0.5 hidden -translate-x-1/2 whitespace-nowrap text-[7px] font-medium text-white/50 sm:block sm:text-[8px]">
                {avatar.name}
              </span>
            </div>
          </div>
        ))}

        <div
          className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400/25 bg-indigo-400/[0.04] drift sm:h-20 sm:w-20"
          style={{ left: "18%", top: "28%" }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between px-0.5 text-[10px] text-zinc-500 sm:mt-3 sm:text-[11px]">
        <span>WASD to move · click to walk</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          live
        </span>
      </div>
    </div>
  );
}
