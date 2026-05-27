"use client";

import clsx from "clsx";
import { RefObject, useCallback, useEffect, useRef } from "react";
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
  /**
   * Ref to the underlying <video> element. If provided we normalise strokes
   * against the visible video content (not the letterboxed tile), so coords
   * remain stable across clients with different tile aspect ratios — and so
   * the desktop overlay can paint them on the streamer's actual screen.
   */
  videoRef?: RefObject<HTMLVideoElement | null>;
}

type ContentBounds = { x: number; y: number; w: number; h: number };

function computeContentBounds(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentBounds {
  if (!videoWidth || !videoHeight || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, w: containerWidth, h: containerHeight };
  }
  const containerRatio = containerWidth / containerHeight;
  const videoRatio = videoWidth / videoHeight;
  if (videoRatio > containerRatio) {
    const w = containerWidth;
    const h = containerWidth / videoRatio;
    return { x: 0, y: (containerHeight - h) / 2, w, h };
  }
  const h = containerHeight;
  const w = containerHeight * videoRatio;
  return { x: (containerWidth - w) / 2, y: 0, w, h };
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
  bounds: ContentBounds
) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(bounds.x + first.x * bounds.w, bounds.y + first.y * bounds.h);
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    ctx.lineTo(bounds.x + p.x * bounds.w, bounds.y + p.y * bounds.h);
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
  videoRef,
}: ScreenAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<DrawPoint[]>([]);
  const drawingRef = useRef(false);

  const getContentBounds = useCallback(
    (containerWidth: number, containerHeight: number): ContentBounds => {
      const video = videoRef?.current;
      const vw = video?.videoWidth ?? 0;
      const vh = video?.videoHeight ?? 0;
      return computeContentBounds(containerWidth, containerHeight, vw, vh);
    },
    [videoRef]
  );

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

    const bounds = getContentBounds(rect.width, rect.height);

    for (const stroke of strokes) {
      drawStroke(ctx, stroke, bounds);
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
        bounds
      );
    }
  }, [activeColor, getContentBounds, interactive, localUserId, strokes, targetId]);

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

  // Repaint when the video reports new intrinsic dimensions (e.g. when the
  // remote stream's resolution changes), otherwise content-relative strokes
  // stay anchored to the previous letterbox geometry.
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;
    const handle = () => paint();
    video.addEventListener("loadedmetadata", handle);
    video.addEventListener("resize", handle);
    return () => {
      video.removeEventListener("loadedmetadata", handle);
      video.removeEventListener("resize", handle);
    };
  }, [paint, videoRef]);

  const pointerToNorm = (event: React.PointerEvent<HTMLCanvasElement>): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const bounds = getContentBounds(rect.width, rect.height);
    if (bounds.w <= 0 || bounds.h <= 0) return null;
    const px = event.clientX - rect.left - bounds.x;
    const py = event.clientY - rect.top - bounds.y;
    return {
      x: Math.min(1, Math.max(0, px / bounds.w)),
      y: Math.min(1, Math.max(0, py / bounds.h)),
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
