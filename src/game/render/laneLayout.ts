import type { LaneCount } from "../rhythm/types";

export interface LaneLayout {
  positions: readonly number[];
  spacing: number;
  trainWidth: number;
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
    trainWidth: Math.min(2.4, spacing * 0.74),
  };
}

