"use client";

import clsx from "clsx";
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  GripVertical,
  MessageSquare,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const WIDTH_KEY = "kumo-sidebar-width";
const SPLIT_KEY = "kumo-sidebar-split";
const CHAT_COLLAPSED_KEY = "kumo-sidebar-chat-collapsed";
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const MIN_SPLIT = 0.28;
const MAX_SPLIT = 0.95;
const DEFAULT_WIDTH = 340;
const DEFAULT_SPLIT = 0.52;
const PRESENTING_SPLIT = 0.74;
const PRESENTING_MIN_WIDTH = 400;
const COLLAPSED_CHAT_HEIGHT = 38;

function loadNumber(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

interface ResizableSidebarProps {
  open: boolean;
  onClose: () => void;
  presenting?: boolean;
  header: React.ReactNode;
  top: React.ReactNode;
  bottom: React.ReactNode;
}

export function ResizableSidebar({
  open,
  onClose,
  presenting = false,
  header,
  top,
  bottom,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const widthDragRef = useRef(false);
  const splitDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setWidth(loadNumber(WIDTH_KEY, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH));
    setSplit(loadNumber(SPLIT_KEY, DEFAULT_SPLIT, MIN_SPLIT, MAX_SPLIT));
    if (typeof window !== "undefined") {
      setChatCollapsed(localStorage.getItem(CHAT_COLLAPSED_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!presenting) return;
    setSplit((current) => Math.max(current, PRESENTING_SPLIT));
    setWidth((current) => Math.max(current, PRESENTING_MIN_WIDTH));
  }, [presenting]);

  const toggleChatCollapsed = useCallback(() => {
    setChatCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        localStorage.setItem(CHAT_COLLAPSED_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const onWidthPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    widthDragRef.current = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSplitPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    splitDragRef.current = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (widthDragRef.current) {
      const next = window.innerWidth - event.clientX;
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
      setWidth(clamped);
      localStorage.setItem(WIDTH_KEY, String(clamped));
    }
    if (splitDragRef.current) {
      const sidebar = document.getElementById("activity-sidebar-panel");
      if (!sidebar) return;
      const rect = sidebar.getBoundingClientRect();
      const headerHeight = 52;
      const usable = rect.height - headerHeight;
      if (usable <= 0) return;
      const y = event.clientY - rect.top - headerHeight;
      const ratio = y / usable;
      const clamped = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, ratio));
      setSplit(clamped);
      localStorage.setItem(SPLIT_KEY, String(clamped));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    widthDragRef.current = false;
    splitDragRef.current = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(28,24,20,0.45)] backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="activity-sidebar-panel"
        style={{ width: open ? width : 0 }}
        className={clsx(
          "z-40 flex h-full shrink-0 flex-col border-l border-[var(--line)] bg-[var(--paper)]",
          "fixed inset-y-0 right-0 lg:static",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          !isDragging && "transition-[width,transform] duration-200 ease-out"
        )}
      >
        {open && (
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onWidthPointerDown}
            className="absolute -left-1.5 top-0 z-50 flex h-full w-3 cursor-col-resize items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink-2)]"
          >
            <GripVertical className="h-4 w-4 opacity-60" />
          </div>
        )}

        {open && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">{header}</div>

            <div
              className={clsx(
                "flex min-h-0 flex-col overflow-hidden",
                presenting ? "bg-[var(--paper-2)]" : "px-0 pt-3"
              )}
              style={
                chatCollapsed
                  ? { flex: "1 1 0%" }
                  : { flex: `${split} 1 0%` }
              }
            >
              {top}
            </div>

            {chatCollapsed ? (
              <button
                type="button"
                onClick={toggleChatCollapsed}
                style={{ height: COLLAPSED_CHAT_HEIGHT }}
                className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-3 text-[11px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                aria-label="Expand chat"
                title="Expand chat"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </span>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  onPointerDown={onSplitPointerDown}
                  className="group relative flex h-3 shrink-0 cursor-row-resize items-center justify-center border-y border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-faint)] hover:bg-[var(--paper-2)] hover:text-[var(--ink-soft)]"
                >
                  <GripHorizontal className="h-3 w-3" />
                  {presenting && (
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleChatCollapsed();
                      }}
                      className="absolute right-2 flex h-4 items-center gap-1 rounded-md border border-[var(--line-2)] bg-[var(--surface)] px-1.5 text-[10px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                      title="Collapse chat"
                      aria-label="Collapse chat"
                    >
                      <ChevronDown className="h-3 w-3" />
                      hide chat
                    </button>
                  )}
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden px-4 pb-4 pt-1" style={{ flex: `${1 - split} 1 0%` }}>
                  {bottom}
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
