import type { LaneCount } from "../rhythm/types";

export interface LaneLayout {
  positions: readonly number[];
  spacing: number;
  trainWidth: number;
  trainLength: number;
}

export function createLaneLayout(laneCount: LaneCount): LaneLayout {
  const spacing = 4 - (laneCount - 2) * 0.45;
  const center = (laneCount - 1) / 2;
  const positions = Array.from(
    { length: laneCount },
    (_, lane) => (lane - center) * spacing,
  );

  return {
    positions,
    spacing,
    trainWidth: Math.min(1.8, spacing * 0.68),
    trainLength: Math.min(1.8, spacing * 0.68) * 1.8,
  };
}
