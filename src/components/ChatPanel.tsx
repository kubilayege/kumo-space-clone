"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { ChatMessage } from "@/lib/types";

type ChatScope = "nearby" | "floor" | "all";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, scope: ChatScope) => void;
  open: boolean;
  onToggle: () => void;
}

const scopeLabels: Record<ChatScope, string> = {
  nearby: "Nearby",
  floor: "Floor",
  all: "All Floors",
};

export function ChatPanel({ messages, onSend, open, onToggle }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<ChatScope>("floor");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text, scope);
    setText("");
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed bottom-24 left-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 lg:hidden"
        aria-label="Toggle chat"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      <aside
        className={clsx(
          "flex h-full flex-col border-l border-white/10 bg-[#14141b]/95 backdrop-blur",
          "fixed inset-y-0 right-0 z-40 w-full max-w-md transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Chat</h2>
            <p className="text-sm text-zinc-400">Nearby, floor, or all-floor messages</p>
          </div>
          <button
            onClick={onToggle}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-white/10 px-5 py-3">
          {(Object.keys(scopeLabels) as ChatScope[]).map((option) => (
            <button
              key={option}
              onClick={() => setScope(option)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm transition",
                scope === option
                  ? "bg-indigo-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              {scopeLabels[option]}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages yet. Say hello to the floor.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="animate-float-in">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: message.userColor }}
                  >
                    {message.userName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-white">{message.userName}</span>
                  <span className="text-xs text-zinc-500">
                    {scopeLabels[message.scope]}
                  </span>
                </div>
                <p className="pl-8 text-sm leading-6 text-zinc-300">{message.text}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Message ${scopeLabels[scope].toLowerCase()}...`}
              className="flex-1 rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/40"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:bg-zinc-700"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
