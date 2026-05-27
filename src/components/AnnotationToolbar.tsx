"use client";

import clsx from "clsx";
import { Eraser, PencilLine } from "lucide-react";
import { ANNOTATION_COLORS } from "@/lib/annotations";

interface AnnotationToolbarProps {
  activeColor: string;
  onColorChange: (color: string) => void;
  onClear?: () => void;
  variant?: "dock" | "overlay";
  className?: string;
}

export function AnnotationToolbar({
  activeColor,
  onColorChange,
  onClear,
  variant = "dock",
  className,
}: AnnotationToolbarProps) {
  const overlay = variant === "overlay";

  return (
    <div
      className={clsx(
        "flex items-center gap-1",
        overlay
          ? "rounded-full border border-white/10 bg-black/70 px-1.5 py-1 shadow-lg backdrop-blur-md"
          : "gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 shadow-[var(--shadow-sm)]",
        className
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!overlay && (
        <>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--ink-2)]">
            <PencilLine className="h-3.5 w-3.5" />
            Draw
          </span>
          <div className="h-4 w-px shrink-0 bg-[var(--line)]" />
        </>
      )}
      {ANNOTATION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title="Pen color"
          onClick={() => onColorChange(color)}
          className={clsx(
            "rounded-full border-2 transition",
            overlay ? "h-4 w-4" : "h-5 w-5",
            activeColor === color
              ? overlay
                ? "scale-110 border-white"
                : "scale-110 border-[var(--ink)]"
              : overlay
                ? "border-white/20 hover:border-white/45"
                : "border-[var(--line-2)] hover:border-[var(--ink-faint)]"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          title="Clear marks on this screen"
          className={clsx(
            "flex items-center justify-center rounded-full transition",
            overlay
              ? "text-zinc-300 hover:bg-white/10 hover:text-white h-6 w-6"
              : "text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] h-7 w-7"
          )}
        >
          <Eraser className={overlay ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      )}
    </div>
  );
}
