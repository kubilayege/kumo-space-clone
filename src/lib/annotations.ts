export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  authorId: string;
  authorColor: string;
  targetId: string;
  color: string;
  width: number;
  points: DrawPoint[];
}

export const ANNOTATION_COLORS = ["#facc15", "#f472b6", "#38bdf8", "#4ade80", "#fb923c"];

export function strokesToMap(strokes: DrawStroke[]): Map<string, DrawStroke[]> {
  const map = new Map<string, DrawStroke[]>();
  for (const stroke of strokes) {
    const list = map.get(stroke.targetId) ?? [];
    list.push(stroke);
    map.set(stroke.targetId, list);
  }
  return map;
}
