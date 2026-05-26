"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { DrawPoint, DrawStroke } from "@/lib/annotations";

interface ScreenAnnotationProps {
  targetId: string;
  strokes: DrawStroke[];
  localUserId: string;
  activeColor: string;
  interactive: boolean;
  onStroke: (stroke: DrawStroke) => void;
  onClear: (targetId: string) => void;
  onColorChange: (color: string) => void;
  /**
   * When true, the built-in floating toolbar in the bottom-right is suppressed.
   * Use this when a parent stage docks its own toolbar in a more prominent slot.
   */
  hideToolbar?: boolean;
}

function newStrokeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawStroke,
  width: number,
  height: number
) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(first.x * width, first.y * height);
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    ctx.lineTo(p.x * width, p.y * height);
  }
  ctx.stroke();
}

export function ScreenAnnotation({
  targetId,
  strokes,
  localUserId,
  activeColor,
  interactive,
  onStroke,
  onClear,
  onColorChange,
  hideToolbar = false,
}: ScreenAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<DrawPoint[]>([]);
  const drawingRef = useRef(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokes) {
      drawStroke(ctx, stroke, rect.width, rect.height);
    }

    if (interactive && draftRef.current.length >= 2) {
      drawStroke(
        ctx,
        {
          id: "draft",
          authorId: localUserId,
          authorColor: activeColor,
          targetId,
          color: activeColor,
          width: 3,
          points: draftRef.current,
        },
        rect.width,
        rect.height
      );
    }
  }, [activeColor, interactive, localUserId, strokes, targetId]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(container);
    return () => observer.disconnect();
  }, [paint]);

  const pointerToNorm = (event: React.PointerEvent<HTMLCanvasElement>): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const point = pointerToNorm(event);
    if (!point) return;
    drawingRef.current = true;
    draftRef.current = [point];
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    paint();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !drawingRef.current) return;
    const point = pointerToNorm(event);
    if (!point) return;
    draftRef.current.push(point);
    paint();
  };

  const finishStroke = () => {
    if (!interactive || !drawingRef.current) return;
    drawingRef.current = false;
    const points = draftRef.current;
    draftRef.current = [];
    if (points.length < 2) {
      paint();
      return;
    }
    onStroke({
      id: newStrokeId(),
      authorId: localUserId,
      authorColor: activeColor,
      targetId,
      color: activeColor,
      width: 3,
      points,
    });
    paint();
  };

  if (strokes.length === 0 && !interactive) {
    return null;
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[8]">
      <canvas
        ref={canvasRef}
        className={clsx(
          "absolute inset-0 h-full w-full touch-none",
          interactive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />

      {interactive && !hideToolbar && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[20]">
          <AnnotationToolbar
            activeColor={activeColor}
            onColorChange={onColorChange}
            onClear={() => onClear(targetId)}
            variant="overlay"
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}
