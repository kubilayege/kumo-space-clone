"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { ChatMessage, getInitials } from "@/lib/types";

type ChatScope = "nearby" | "floor" | "all";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, scope: ChatScope) => void;
  currentUserId?: string;
}

const SCOPES: { value: ChatScope; label: string; hint: string }[] = [
  { value: "nearby", label: "Nearby", hint: "people within audio range" },
  { value: "floor", label: "Floor", hint: "everyone on this floor" },
  { value: "all", label: "All", hint: "broadcast to all spaces" },
];

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ messages, onSend, currentUserId }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<ChatScope>("floor");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text, scope);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
        <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
        <h3 className="text-[13px] font-semibold tracking-tight text-white">Chat</h3>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
          {messages.length}
        </span>
      </div>

      {/* Scope tabs */}
      <div className="shrink-0 px-4 pb-2">
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              onClick={() => setScope(option.value)}
              title={option.hint}
              className={clsx(
                "flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
                scope === option.value
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="mt-2 text-[12px] font-medium text-zinc-300">No messages yet</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                Say hi to the floor or whisper to someone nearby.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, i) => {
            const previousMessage = messages[i - 1];
            const sameAuthor =
              previousMessage &&
              previousMessage.userId === message.userId &&
              message.timestamp - previousMessage.timestamp < 60_000;
            const isSelf = currentUserId && message.userId === currentUserId;

            return (
              <div key={message.id} className="animate-float-in">
                {!sameAuthor && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: message.userColor }}
                    >
                      {getInitials(message.userName)}
                    </span>
                    <span className="text-[12px] font-medium text-white">
                      {message.userName}
                      {isSelf && <span className="ml-1 text-indigo-300">· you</span>}
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
                <p
                  className={clsx(
                    "pl-7 text-[13px] leading-5",
                    isSelf ? "text-zinc-100" : "text-zinc-300"
                  )}
                >
                  {message.text}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0a0a14]/80 px-3 py-2 transition focus-within:border-indigo-400/40 focus-within:ring-4 focus-within:ring-indigo-500/10">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Message ${scope === "nearby" ? "nearby" : scope === "all" ? "all spaces" : "the floor"}…`}
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-xl transition",
              text.trim()
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
                : "bg-white/[0.04] text-zinc-500"
            )}
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  );
}
