"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Sparkles, Users, Volume2 } from "lucide-react";
import { AVATAR_COLORS } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("main-office");
  const [color, setColor] = useState(AVATAR_COLORS[0]);

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const params = new URLSearchParams({
      name: name.trim(),
      color,
    });

    router.push(`/space/${encodeURIComponent(spaceId)}?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#312e81_0%,_#0f0f14_45%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-indigo-200/80">Virtual Office</p>
              <h1 className="text-xl font-semibold text-white">Kumo Space Clone</h1>
            </div>
          </div>
          <Link
            href="/space/demo?color=%236366f1&name=Demo+User"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-indigo-400/40 hover:text-white"
          >
            Try demo space
          </Link>
        </header>

        <section className="mt-16 grid flex-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-float-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200">
              <Sparkles className="h-4 w-4" />
              Spatial collaboration for remote teams
            </div>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              Work together in a shared virtual office
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
              Move your avatar through rooms, talk to people nearby with spatial audio,
              jump into focus pods, and chat with your whole floor.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "Live presence",
                  text: "See who is online and where they are on the floor.",
                },
                {
                  icon: Volume2,
                  title: "Spatial audio",
                  text: "Conversations fade naturally as you walk away.",
                },
                {
                  icon: Building2,
                  title: "Room zones",
                  text: "Meeting rooms, lounge, focus pods, and open desks.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <Icon className="mb-3 h-5 w-5 text-indigo-300" />
                  <h3 className="font-medium text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleJoin}
            className="animate-float-in rounded-3xl border border-white/10 bg-[#18181f]/90 p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur"
          >
            <h3 className="text-2xl font-semibold text-white">Join a space</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Create or enter a space ID and invite your team with the same link.
            </p>

            <label className="mt-8 block text-sm font-medium text-zinc-300">
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Morgan"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 text-white outline-none ring-indigo-500/0 transition focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <label className="mt-5 block text-sm font-medium text-zinc-300">
              Space ID
              <input
                value={spaceId}
                onChange={(event) => setSpaceId(event.target.value)}
                placeholder="main-office"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 text-white outline-none transition focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <div className="mt-5">
              <p className="text-sm font-medium text-zinc-300">Avatar color</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {AVATAR_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setColor(option)}
                    className={`h-9 w-9 rounded-full border-2 transition ${
                      color === option ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: option }}
                    aria-label={`Select color ${option}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-8 w-full rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
            >
              Enter space
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
