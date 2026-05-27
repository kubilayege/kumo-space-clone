"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { DrawStroke } from "@/lib/annotations";

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawStroke,
  width: number,
  height: number
) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(stroke.width, 4);
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

function OverlayCanvas() {
  const params = useSearchParams();
  const spaceId = params.get("space");
  const targetUserId = params.get("user");
  const socketUrlOverride = params.get("socket");
  const debug = params.get("debug") !== "0";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [size, setSize] = useState<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });

  useEffect(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const prevHtmlBg = docEl.style.background;
    const prevBodyBg = body.style.background;
    const prevBodyMargin = body.style.margin;
    docEl.style.background = "transparent";
    body.style.background = "transparent";
    body.style.margin = "0";
    return () => {
      docEl.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      body.style.margin = prevBodyMargin;
    };
  }, []);

  useEffect(() => {
    if (!spaceId || !targetUserId) return;

    const url =
      socketUrlOverride ??
      process.env.NEXT_PUBLIC_SOCKET_URL ??
      "http://localhost:3001";

    const socket: Socket = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });

    let cancelled = false;

    const handleStroke = (stroke: DrawStroke) => {
      if (cancelled) return;
      if (stroke.targetId !== targetUserId) return;
      setStrokes((current) => [...current, stroke]);
    };

    const handleClear = (payload: { targetId: string }) => {
      if (cancelled) return;
      if (payload.targetId !== targetUserId) return;
      setStrokes([]);
    };

    socket.on("annotate:stroke", handleStroke);
    socket.on("annotate:clear", handleClear);

    socket.on("connect", () => {
      socket.emit(
        "space:observe",
        { spaceId },
        (response: { annotations: DrawStroke[] }) => {
          if (cancelled) return;
          const initial =
            response?.annotations?.filter((s) => s.targetId === targetUserId) ?? [];
          if (initial.length > 0) setStrokes(initial);
        }
      );
    });

    socket.connect();

    return () => {
      cancelled = true;
      socket.off("annotate:stroke", handleStroke);
      socket.off("annotate:clear", handleClear);
      socket.disconnect();
    };
  }, [spaceId, targetUserId, socketUrlOverride]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (const stroke of strokes) {
        drawStroke(ctx, stroke, width, height);
      }
      setSize((prev) =>
        prev.w === width && prev.h === height && prev.dpr === dpr
          ? prev
          : { w: width, h: height, dpr }
      );
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [strokes]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          background: "transparent",
        }}
      />
      {debug && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              border: "2px dashed rgba(255, 0, 128, 0.55)",
              pointerEvents: "none",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              padding: "6px 10px",
              borderRadius: 6,
              background: "rgba(0, 0, 0, 0.55)",
              color: "#fff",
              font: "12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace",
              pointerEvents: "none",
            }}
          >
            overlay {size.w}×{size.h} · dpr {size.dpr} · strokes {strokes.length}
          </div>
        </>
      )}
    </>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={null}>
      <OverlayCanvas />
    </Suspense>
  );
}
