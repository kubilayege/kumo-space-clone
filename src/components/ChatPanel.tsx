"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Globe,
  Layers,
  MessageSquare,
  Radio,
  Send,
  Sparkles,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { ChatMessage, ChatScope, RoomZone, TypingUser, getInitials } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, scope: ChatScope) => void;
  currentUserId?: string;
  currentZone?: RoomZone | null;
  typingUsers?: TypingUser[];
}

const TYPING_EMIT_THROTTLE_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 3000;

const SCOPES: {
  value: ChatScope;
  label: string;
  hint: string;
  icon: typeof Radio;
}[] = [
  {
    value: "nearby",
    label: "Nearby",
    hint: "people within audio range",
    icon: Radio,
  },
  {
    value: "floor",
    label: "Floor",
    hint: "everyone on this floor",
    icon: Layers,
  },
  {
    value: "all",
    label: "All",
    hint: "broadcast to all spaces",
    icon: Globe,
  },
];

const GROUP_THRESHOLD_MS = 60_000;
const SEPARATOR_THRESHOLD_MS = 5 * 60_000;

function defaultScopeForZone(zone: RoomZone | null | undefined): ChatScope {
  if (!zone) return "floor";
  if (zone.type === "meeting" || zone.type === "focus") return "nearby";
  return "floor";
}

function placeholderForScope(scope: ChatScope, zone: RoomZone | null | undefined): string {
  if (scope === "all") return "Message all spaces…";
  if (scope === "nearby") {
    if (zone) return `Whisper in ${zone.name}…`;
    return "Message nearby…";
  }
  if (zone?.type === "lounge") return `Say hi in ${zone.name}…`;
  if (zone) return `Message ${zone.name}…`;
  return "Message the floor…";
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return `Today · ${formatTime(timestamp)}`;
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) {
    return `Yesterday · ${formatTime(timestamp)}`;
  }
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shouldShowSeparator(current: ChatMessage, previous?: ChatMessage) {
  if (!previous) return true;
  if (current.timestamp - previous.timestamp >= SEPARATOR_THRESHOLD_MS) return true;

  const currentDay = new Date(current.timestamp).toDateString();
  const previousDay = new Date(previous.timestamp).toDateString();
  return currentDay !== previousDay;
}

function isSameGroup(current: ChatMessage, previous?: ChatMessage) {
  if (!previous) return false;
  return (
    previous.userId === current.userId &&
    current.timestamp - previous.timestamp < GROUP_THRESHOLD_MS
  );
}

function formatTypingLabel(typers: TypingUser[]): string {
  if (typers.length === 0) return "";
  if (typers.length === 1) return `${typers[0].userName} is typing…`;
  if (typers.length === 2) return `${typers[0].userName} and ${typers[1].userName} are typing…`;
  const remaining = typers.length - 2;
  return `${typers[0].userName}, ${typers[1].userName}, and ${remaining} ${remaining === 1 ? "other" : "others"} are typing…`;
}

function TypingIndicator({ typers }: { typers: TypingUser[] }) {
  if (typers.length === 0) return null;
  const visible = typers.slice(0, 3);
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex -space-x-1.5">
        {visible.map((typer) => (
          <span
            key={typer.userId}
            title={typer.userName}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2 ring-[#0a0a14]"
            style={{ backgroundColor: typer.userColor }}
          >
            {getInitials(typer.userName)}
          </span>
        ))}
      </div>
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400/80 [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400/80 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400/80 [animation-delay:300ms]" />
      </span>
      <span className="truncate text-[11px] text-zinc-500">{formatTypingLabel(typers)}</span>
    </div>
  );
}

export function ChatPanel({
  messages,
  onSend,
  currentUserId,
  currentZone,
  typingUsers = [],
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<ChatScope>(() => defaultScopeForZone(currentZone));
  const [zoneFlash, setZoneFlash] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevZoneIdRef = useRef<string | null | undefined>(undefined);

  // Typing-emit bookkeeping.
  const lastTypingEmitRef = useRef(0);
  const idleStopTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const currentScopeRef = useRef<ChatScope>(scope);

  const clearIdleStopTimer = () => {
    if (idleStopTimerRef.current !== null) {
      window.clearTimeout(idleStopTimerRef.current);
      idleStopTimerRef.current = null;
    }
  };

  const emitTypingStop = (scopeToStop: ChatScope) => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    lastTypingEmitRef.current = 0;
    clearIdleStopTimer();
    getSocket().emit("chat:typing:stop", { scope: scopeToStop });
  };

  // Keep the ref in sync; when scope changes, stop typing in the previous scope.
  useEffect(() => {
    const previousScope = currentScopeRef.current;
    if (previousScope !== scope) {
      emitTypingStop(previousScope);
    }
    currentScopeRef.current = scope;
  }, [scope]);

  // Stop typing on unmount.
  useEffect(() => {
    return () => {
      emitTypingStop(currentScopeRef.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  useEffect(() => {
    const zoneId = currentZone?.id ?? null;
    if (prevZoneIdRef.current !== undefined && prevZoneIdRef.current !== zoneId) {
      setScope(defaultScopeForZone(currentZone));
      setZoneFlash(true);
      const timer = window.setTimeout(() => setZoneFlash(false), 600);
      prevZoneIdRef.current = zoneId;
      return () => window.clearTimeout(timer);
    }
    prevZoneIdRef.current = zoneId;
  }, [currentZone]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = event.target.value;
    setText(nextText);

    if (!nextText.trim()) {
      emitTypingStop(scope);
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current >= TYPING_EMIT_THROTTLE_MS) {
      lastTypingEmitRef.current = now;
      isTypingRef.current = true;
      getSocket().emit("chat:typing", { scope });
    }

    clearIdleStopTimer();
    idleStopTimerRef.current = window.setTimeout(() => {
      emitTypingStop(scope);
    }, TYPING_IDLE_TIMEOUT_MS);
  };

  const handleInputBlur = () => {
    emitTypingStop(scope);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text, scope);
    setText("");
    emitTypingStop(scope);
  };

  const activeScope = SCOPES.find((option) => option.value === scope);

  // Only show typers whose declared scope matches the current scope tab.
  // (Sender's intent — where they're typing into — is what matters here.)
  const visibleTypers = typingUsers.filter(
    (typer) => typer.userId !== currentUserId && typer.scope === scope
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={clsx(
          "flex shrink-0 items-center gap-2 px-4 pb-2 transition-colors duration-300",
          zoneFlash && "bg-indigo-500/10"
        )}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10">
          <MessageSquare className="h-3.5 w-3.5 text-indigo-300" />
        </div>
        <h3 className="text-[13px] font-semibold tracking-tight text-white">
          Chat{currentZone ? ` · ${currentZone.name}` : ""}
        </h3>
        {currentZone && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize text-zinc-800"
            style={{ backgroundColor: currentZone.color }}
          >
            {currentZone.type}
          </span>
        )}
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
          {messages.length}
        </span>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <div className="flex gap-1 rounded-xl border border-white/[0.04] bg-white/[0.03] p-1 backdrop-blur-sm">
          {SCOPES.map((option) => {
            const Icon = option.icon;
            const isActive = scope === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setScope(option.value)}
                title={option.hint}
                className={clsx(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-500/15 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/30"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                )}
              >
                <Icon
                  className={clsx(
                    "h-3 w-3 shrink-0 transition-colors",
                    isActive ? "text-indigo-300" : "text-zinc-500"
                  )}
                />
                {option.label}
              </button>
            );
          })}
        </div>
        {scope === "nearby" && currentZone && (
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Only people in {currentZone.name} and nearby range
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-2 text-center">
            <div className="relative max-w-[220px]">
              <div className="pointer-events-none absolute -inset-8 rounded-full bg-indigo-500/10 blur-2xl" />
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/10 to-violet-500/5 shadow-[0_8px_32px_rgba(99,102,241,0.12)]">
                <Sparkles className="h-5 w-5 text-indigo-300/80" />
              </div>
              <p className="relative mt-4 text-[13px] font-medium text-zinc-200">
                Start the conversation
              </p>
              <p className="relative mt-1.5 text-[11px] leading-5 text-zinc-500">
                {currentZone
                  ? `Say something in ${currentZone.name} or reach people nearby.`
                  : "Say hi to the floor, whisper to someone nearby, or broadcast to all spaces."}
              </p>
              <div className="relative mt-4 flex items-center justify-center gap-1.5">
                {SCOPES.map((option) => {
                  const Icon = option.icon;
                  return (
                    <span
                      key={option.value}
                      className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[9px] text-zinc-500"
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {option.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const previousMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              const sameAuthor = isSameGroup(message, previousMessage);
              const sameAuthorNext = nextMessage
                ? isSameGroup(nextMessage, message)
                : false;
              const isSelf = Boolean(currentUserId && message.userId === currentUserId);
              const showSeparator = shouldShowSeparator(message, previousMessage);

              return (
                <div key={message.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                      <span className="shrink-0 text-[10px] font-medium tracking-wide text-zinc-600">
                        {formatDateSeparator(message.timestamp)}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    </div>
                  )}

                  <div
                    className={clsx(
                      "animate-float-in flex",
                      isSelf ? "justify-end" : "justify-start",
                      sameAuthor ? "mt-0.5" : "mt-2"
                    )}
                  >
                    <div
                      className={clsx(
                        "flex max-w-[88%] gap-2",
                        isSelf ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {!isSelf && (
                        <div className="w-6 shrink-0">
                          {!sameAuthor ? (
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white shadow-sm ring-1 ring-white/10"
                              style={{ backgroundColor: message.userColor }}
                            >
                              {getInitials(message.userName)}
                            </span>
                          ) : null}
                        </div>
                      )}

                      <div className={clsx("min-w-0", isSelf ? "items-end" : "items-start")}>
                        {!sameAuthor && (
                          <div
                            className={clsx(
                              "mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1",
                              isSelf && "justify-end"
                            )}
                          >
                            <span className="text-[11px] font-medium text-zinc-300">
                              {isSelf ? "You" : message.userName}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {formatTime(message.timestamp)}
                            </span>
                            {message.scope !== "floor" && (
                              <span
                                className={clsx(
                                  "rounded-full border px-1.5 py-0 text-[9px] font-medium",
                                  message.scope === "nearby"
                                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                    : "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                                )}
                              >
                                {message.scope === "nearby" ? "nearby" : "all"}
                              </span>
                            )}
                          </div>
                        )}

                        <div
                          className={clsx(
                            "px-3 py-2 text-[13px] leading-5",
                            isSelf
                              ? clsx(
                                  "bg-gradient-to-br from-indigo-500/90 to-violet-600/90 text-white shadow-[0_4px_16px_rgba(99,102,241,0.2)]",
                                  sameAuthor && !sameAuthorNext
                                    ? "rounded-2xl rounded-tr-md"
                                    : sameAuthor && sameAuthorNext
                                      ? "rounded-2xl rounded-tr-md rounded-br-md"
                                      : !sameAuthor && sameAuthorNext
                                        ? "rounded-2xl rounded-tr-md rounded-br-md"
                                        : "rounded-2xl rounded-br-md"
                                )
                              : clsx(
                                  "border border-white/[0.06] bg-white/[0.05] text-zinc-200 backdrop-blur-sm",
                                  sameAuthor && !sameAuthorNext
                                    ? "rounded-2xl rounded-tl-md"
                                    : sameAuthor && sameAuthorNext
                                      ? "rounded-2xl rounded-tl-md rounded-bl-md"
                                      : !sameAuthor && sameAuthorNext
                                        ? "rounded-2xl rounded-tl-md rounded-bl-md"
                                        : "rounded-2xl rounded-bl-md"
                                )
                          )}
                        >
                          {message.text}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        )}
        {visibleTypers.length > 0 && (
          <div className="mt-3">
            <TypingIndicator typers={visibleTypers} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-2">
        <div
          className={clsx(
            "rounded-2xl p-px transition-all duration-200",
            text.trim()
              ? "bg-gradient-to-r from-indigo-500/50 via-violet-500/40 to-indigo-500/50 shadow-[0_0_24px_rgba(99,102,241,0.15)]"
              : "bg-gradient-to-r from-white/[0.08] via-indigo-500/20 to-white/[0.08]"
          )}
        >
          <div className="flex items-center gap-2 rounded-[15px] bg-[#0a0a14]/95 px-3 py-2 backdrop-blur-sm">
            <input
              value={text}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder={placeholderForScope(scope, currentZone)}
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-zinc-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                text.trim()
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/45"
                  : "bg-white/[0.04] text-zinc-600"
              )}
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-center text-[10px] text-zinc-600">
          Sending to {activeScope?.hint ?? "everyone on this floor"}
        </p>
      </form>
    </div>
  );
}
