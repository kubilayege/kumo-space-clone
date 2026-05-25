"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, Sparkles, Users, Volume2 } from "lucide-react";
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

const PREVIEW_DOTS = [
  { x: 32, y: 38, color: "#6366f1", delay: 0 },
  { x: 58, y: 30, color: "#ec4899", delay: 0.8 },
  { x: 72, y: 58, color: "#22c55e", delay: 1.6 },
  { x: 24, y: 64, color: "#f97316", delay: 2.4 },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("main-office");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#07070d]">
      {/* Background ambient gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -left-32 top-1/3 h-[480px] w-[480px] bg-indigo-600/20 blur-3xl" />
        <div className="blob absolute -right-32 top-12 h-[420px] w-[420px] bg-violet-600/20 blur-3xl" />
        <div className="blob absolute bottom-0 left-1/3 h-[380px] w-[380px] bg-fuchsia-600/10 blur-3xl" />
      </div>

      {/* Dot grid overlay */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-6 py-6 lg:px-10">
        <header className="flex shrink-0 items-center justify-between">
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
            className="group hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:inline-flex"
          >
            Try demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-0">
          {/* Hero */}
          <div className={mounted ? "animate-float-in" : "opacity-0"}>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[12px] font-medium text-indigo-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Now in beta · No signup
            </div>

            <h1 className="mt-5 text-[44px] font-semibold leading-[1.05] tracking-tight text-white text-balance md:text-[56px]">
              The office, but{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                wherever
              </span>{" "}
              you are.
            </h1>

            <p className="mt-5 max-w-lg text-[17px] leading-7 text-zinc-400 text-balance">
              Drop your avatar into a shared floor. Walk up to teammates to start talking — voice fades as you walk away. Hang out, work, and ship together.
            </p>

            {/* Mini office preview */}
            <div className="mt-9 hidden lg:block">
              <OfficePreview />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:hidden">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <Icon className="mb-2 h-4 w-4 text-indigo-300" />
                  <h3 className="text-sm font-medium text-white">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form card */}
          <form
            onSubmit={handleJoin}
            className={`glass-strong relative rounded-3xl p-7 shadow-[0_40px_80px_-20px_rgba(99,102,241,0.35)] ${
              mounted ? "animate-scale-in" : "opacity-0"
            }`}
          >
            <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/20 via-transparent to-fuchsia-500/10 opacity-50" />

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300/80">
                Step in
              </p>
              <h2 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-white">
                Join a space
              </h2>
              <p className="mt-1.5 text-[13px] text-zinc-400">
                Share the Space ID with anyone — same ID, same room.
              </p>

              <div className="mt-7 space-y-4">
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
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {AVATAR_COLORS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setColor(option)}
                        className={`relative h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                          color === option ? "scale-110" : ""
                        }`}
                        style={{ backgroundColor: option }}
                        aria-label={`Select color ${option}`}
                      >
                        {color === option && (
                          <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2 ring-offset-[#0b0b14]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3.5 text-[15px] font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:shadow-none"
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
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0a0a14]/80 px-3.5 py-2.5 text-[14px] text-white placeholder:text-zinc-600 transition focus:border-indigo-400/50 focus:bg-[#0a0a14] focus:ring-4 focus:ring-indigo-500/15"
      />
      {hint && <span className="mt-1.5 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function OfficePreview() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0e0e18] to-[#0a0a14] p-3 shadow-2xl shadow-black/40">
      <div className="absolute left-4 top-3.5 z-10 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
      </div>
      <div className="absolute right-4 top-3.5 z-10 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
        main-office · 4 online
      </div>

      <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-2xl floor-pattern">
        {/* Zones */}
        <div className="absolute left-[6%] top-[12%] h-[42%] w-[44%] rounded-2xl border border-white/5 bg-indigo-500/[0.06]">
          <span className="absolute left-3 top-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/70">
            Workspace
          </span>
        </div>
        <div className="absolute right-[6%] top-[12%] h-[34%] w-[40%] rounded-2xl border border-white/5 bg-amber-500/[0.07]">
          <span className="absolute left-3 top-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/70">
            Meeting
          </span>
        </div>
        <div className="absolute bottom-[8%] left-[6%] h-[34%] w-[44%] rounded-2xl border border-white/5 bg-fuchsia-500/[0.06]">
          <span className="absolute left-3 top-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/70">
            Lounge
          </span>
        </div>
        <div className="absolute bottom-[8%] right-[6%] h-[34%] w-[40%] rounded-2xl border border-white/5 bg-emerald-500/[0.06]">
          <span className="absolute left-3 top-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/70">
            Focus
          </span>
        </div>

        {/* Avatars */}
        {PREVIEW_DOTS.map((dot, i) => (
          <div
            key={i}
            className="absolute drift"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              animationDelay: `${dot.delay}s`,
            }}
          >
            <div
              className="h-3.5 w-3.5 rounded-full ring-2 ring-white/30 shadow-lg"
              style={{ backgroundColor: dot.color }}
            />
          </div>
        ))}

        {/* Proximity ring around first avatar */}
        <div
          className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400/30 bg-indigo-400/[0.04] drift"
          style={{ left: "32%", top: "38%" }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-zinc-500">
        <span>WASD to move · click to walk</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          live
        </span>
      </div>
    </div>
  );
}
