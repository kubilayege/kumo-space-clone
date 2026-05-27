"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  Eraser,
  MousePointer2,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { OfficeMap, RoomZone } from "@/lib/types";

interface SpaceEditorProps {
  spaceId: string;
  map: OfficeMap;
  onPublish: (map: OfficeMap) => void;
  onClose: () => void;
}

type Tool = "select" | "add" | "erase";

const FLOOR_SWATCHES = ["#FAF6EB", "#E8DEC1", "#F3DDC1", "#ECE3CC", "#D9CFB5", "#C8C1B0"];
const ROOM_TYPES: RoomZone["type"][] = ["open", "meeting", "focus", "lounge"];

let zoneCounter = 0;
function newZoneId() {
  zoneCounter += 1;
  return `room-${Date.now().toString(36)}-${zoneCounter}`;
}

export function SpaceEditor({ spaceId, map, onPublish, onClose }: SpaceEditorProps) {
  const [zones, setZones] = useState<RoomZone[]>(() => map.zones.map((z) => ({ ...z })));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [dirty, setDirty] = useState(false);

  const past = useRef<RoomZone[][]>([]);
  const future = useRef<RoomZone[][]>([]);

  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const scale = boardWidth ? boardWidth / map.width : 0;

  const dragRef = useRef<
    | {
        mode: "move" | "resize";
        id: string;
        startX: number;
        startY: number;
        orig: RoomZone;
      }
    | null
  >(null);

  useLayoutEffect(() => {
    const update = () => {
      if (boardRef.current) setBoardWidth(boardRef.current.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    if (boardRef.current) observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  const commit = useCallback((next: RoomZone[]) => {
    past.current.push(zonesSnapshotRef.current);
    if (past.current.length > 50) past.current.shift();
    future.current = [];
    zonesSnapshotRef.current = next;
    setZones(next);
    setDirty(true);
  }, []);

  // Keep a live snapshot for history without stale closures.
  const zonesSnapshotRef = useRef<RoomZone[]>(zones);
  useEffect(() => {
    zonesSnapshotRef.current = zones;
  }, [zones]);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(zonesSnapshotRef.current);
    zonesSnapshotRef.current = prev;
    setZones(prev);
    setDirty(true);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(zonesSnapshotRef.current);
    zonesSnapshotRef.current = next;
    setZones(next);
    setDirty(true);
  };

  const selected = zones.find((z) => z.id === selectedId) ?? null;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    const s = rect.width / map.width;
    return {
      x: (clientX - rect.left) / s,
      y: (clientY - rect.top) / s,
    };
  };

  const handleBoardPointerDown = (event: React.PointerEvent) => {
    if (tool !== "add") {
      if (event.target === boardRef.current) setSelectedId(null);
      return;
    }
    const { x, y } = toWorld(event.clientX, event.clientY);
    const width = 240;
    const height = 180;
    const zone: RoomZone = {
      id: newZoneId(),
      name: "New room",
      x: Math.max(0, Math.min(map.width - width, x - width / 2)),
      y: Math.max(0, Math.min(map.height - height, y - height / 2)),
      width,
      height,
      type: "open",
      color: "#ECE3CC",
    };
    commit([...zones, zone]);
    setSelectedId(zone.id);
    setTool("select");
  };

  const handleZonePointerDown = (event: React.PointerEvent, zone: RoomZone) => {
    event.stopPropagation();
    if (tool === "erase") {
      commit(zones.filter((z) => z.id !== zone.id));
      if (selectedId === zone.id) setSelectedId(null);
      return;
    }
    setSelectedId(zone.id);
    const { x, y } = toWorld(event.clientX, event.clientY);
    dragRef.current = { mode: "move", id: zone.id, startX: x, startY: y, orig: { ...zone } };
    // Snapshot once at gesture start for a single undo step.
    past.current.push(zonesSnapshotRef.current);
    future.current = [];
  };

  const handleResizePointerDown = (event: React.PointerEvent, zone: RoomZone) => {
    event.stopPropagation();
    setSelectedId(zone.id);
    const { x, y } = toWorld(event.clientX, event.clientY);
    dragRef.current = { mode: "resize", id: zone.id, startX: x, startY: y, orig: { ...zone } };
    past.current.push(zonesSnapshotRef.current);
    future.current = [];
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !boardRef.current) return;
      const { x, y } = toWorld(event.clientX, event.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      setZones((current) =>
        current.map((z) => {
          if (z.id !== drag.id) return z;
          if (drag.mode === "move") {
            return {
              ...z,
              x: Math.max(0, Math.min(map.width - z.width, drag.orig.x + dx)),
              y: Math.max(0, Math.min(map.height - z.height, drag.orig.y + dy)),
            };
          }
          return {
            ...z,
            width: Math.max(80, Math.min(map.width - z.x, drag.orig.width + dx)),
            height: Math.max(80, Math.min(map.height - z.y, drag.orig.height + dy)),
          };
        })
      );
      setDirty(true);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.width, map.height]);

  const updateSelected = (patch: Partial<RoomZone>) => {
    if (!selected) return;
    commit(zones.map((z) => (z.id === selected.id ? { ...z, ...patch } : z)));
  };

  const handlePublish = () => {
    onPublish({ width: map.width, height: map.height, zones });
    setDirty(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--paper)]">
      {/* sub header */}
      <div className="flex h-12 items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-4">
        <span className="text-[13px] font-medium text-[var(--ink)]">{spaceId}</span>
        <span className="text-[13px] text-[var(--ink-faint)]">/</span>
        <span className="text-[13px] text-[var(--ink-2)]">Editing</span>
        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--accent)]">
          Editing
        </span>
        <div className="flex-1" />
        <button
          onClick={undo}
          title="Undo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition hover:bg-[var(--paper-2)]"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          title="Redo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition hover:bg-[var(--paper-2)]"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <span className="mx-1 font-mono text-[11px] text-[var(--ink-faint)]">
          {dirty ? "UNSAVED" : "PUBLISHED"}
        </span>
        <button
          onClick={onClose}
          className="rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
        >
          Exit
        </button>
        <button
          onClick={handlePublish}
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-[var(--accent-hover)]"
        >
          <Check className="h-3.5 w-3.5" />
          Publish
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* tool rail */}
        <div className="flex w-16 flex-col items-center gap-1 border-r border-[var(--line)] bg-[var(--paper-2)] py-3">
          <ToolButton icon={MousePointer2} label="Select" active={tool === "select"} onClick={() => setTool("select")} />
          <ToolButton icon={Plus} label="Room" active={tool === "add"} onClick={() => setTool("add")} />
          <ToolButton icon={Eraser} label="Erase" active={tool === "erase"} onClick={() => setTool("erase")} />
        </div>

        {/* canvas */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--paper-2)] p-6">
          <div
            ref={boardRef}
            onPointerDown={handleBoardPointerDown}
            className="relative w-full max-w-[900px] overflow-hidden rounded-lg border border-[var(--line-2)] bg-[var(--floor)] shadow-[var(--shadow-md)]"
            style={{
              aspectRatio: `${map.width} / ${map.height}`,
              backgroundImage:
                "linear-gradient(var(--grid-strong) 1px, transparent 1px), linear-gradient(90deg, var(--grid-strong) 1px, transparent 1px)",
              backgroundSize: `${28 * scale || 28}px ${28 * scale || 28}px`,
              cursor: tool === "add" ? "crosshair" : "default",
            }}
          >
            {scale > 0 &&
              zones.map((zone) => {
                const isSel = zone.id === selectedId;
                return (
                  <div
                    key={zone.id}
                    onPointerDown={(event) => handleZonePointerDown(event, zone)}
                    className="absolute overflow-hidden rounded-[3px] border-[1.5px]"
                    style={{
                      left: zone.x * scale,
                      top: zone.y * scale,
                      width: zone.width * scale,
                      height: zone.height * scale,
                      background: zone.color,
                      borderColor: isSel ? "var(--accent)" : "var(--wall-2)",
                      boxShadow: isSel ? "0 0 0 2px var(--accent-ring)" : undefined,
                      cursor: tool === "erase" ? "not-allowed" : "move",
                    }}
                  >
                    <span className="absolute left-2 top-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-2)]">
                      {zone.name}
                    </span>
                    {isSel && tool === "select" && (
                      <span
                        onPointerDown={(event) => handleResizePointerDown(event, zone)}
                        className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize rounded-tl-[3px] bg-[var(--accent)]"
                      />
                    )}
                  </div>
                );
              })}
          </div>

          <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-soft)] shadow-[var(--shadow-sm)]">
            {tool === "add"
              ? "Click the floor to place a room"
              : tool === "erase"
                ? "Click a room to remove it"
                : "Drag to move · corner to resize"}
          </div>
        </div>

        {/* right rail */}
        <div className="flex w-[240px] flex-col gap-5 overflow-y-auto border-l border-[var(--line)] bg-[var(--paper)] p-4">
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Floor texture
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {FLOOR_SWATCHES.map((fill) => {
                const active = selected?.color === fill;
                return (
                  <button
                    key={fill}
                    disabled={!selected}
                    onClick={() => updateSelected({ color: fill })}
                    className="aspect-square rounded-md transition disabled:opacity-40"
                    style={{
                      background: fill,
                      boxShadow: active
                        ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)"
                        : "0 0 0 1px var(--line-2)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Selected room
            </div>
            {selected ? (
              <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <input
                  value={selected.name}
                  onChange={(event) => updateSelected({ name: event.target.value })}
                  className="mb-2 w-full rounded-md border border-[var(--line-2)] bg-[var(--surface)] px-2 py-1.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                <label className="mb-2 block">
                  <span className="mb-1 block text-[11px] text-[var(--ink-soft)]">Type</span>
                  <select
                    value={selected.type}
                    onChange={(event) =>
                      updateSelected({ type: event.target.value as RoomZone["type"] })
                    }
                    className="w-full cursor-pointer rounded-md border border-[var(--line-2)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)] outline-none"
                  >
                    {ROOM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Width" value={`${Math.round(selected.width)} px`} />
                <Field label="Height" value={`${Math.round(selected.height)} px`} />
                <button
                  onClick={() => {
                    commit(zones.filter((z) => z.id !== selected.id));
                    setSelectedId(null);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-1.5 text-[12px] font-medium text-[var(--accent-hover)] transition hover:bg-[var(--accent)]/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete room
                </button>
              </div>
            ) : (
              <p className="rounded-[10px] border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-3 text-[12px] text-[var(--ink-faint)]">
                Select a room to edit it, or use the Room tool to add one.
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setZones(map.zones.map((z) => ({ ...z })));
              setSelectedId(null);
              setDirty(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--surface-2)]"
          >
            <X className="h-3.5 w-3.5" />
            Reset to current
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-[10px] transition ${
        active ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
      <span className="font-mono text-[9px] uppercase tracking-[0.04em]">{label}</span>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="font-mono text-[11px] text-[var(--ink)]">{value}</span>
    </div>
  );
}
