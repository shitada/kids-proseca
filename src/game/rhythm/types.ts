export type LaneIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type LaneCount = 2 | 3 | 4 | 5 | 6;
export type NoteType = "tap" | "hold";

export function isLaneIndex(value: number): value is LaneIndex {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

export interface RhythmNote {
  id: string;
  lane: LaneIndex;
  time: number;
  type: NoteType;
  duration: number;
  midiNote: number;
}

export type NoteStatus = "pending" | "holding" | "hit" | "missed";
export type JudgementKind = "perfect" | "good" | "empty";
export type JudgementPhase =
  | "tap"
  | "hold-start"
  | "hold-complete"
  | "hold-break"
  | "empty";

export interface NoteState {
  note: RhythmNote;
  status: NoteStatus;
}

export interface JudgementResult {
  kind: JudgementKind;
  phase: JudgementPhase;
  note?: RhythmNote;
  offset?: number;
}

export interface EngineUpdate {
  misses: readonly RhythmNote[];
  completedHolds: readonly JudgementResult[];
}

export interface JudgementSummary {
  perfect: number;
  good: number;
  missed: number;
  total: number;
}
