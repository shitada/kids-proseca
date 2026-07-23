export type LaneIndex = 0 | 1;
export type NoteType = "tap" | "hold";

export interface RhythmNote {
  id: string;
  lane: LaneIndex;
  time: number;
  type: NoteType;
  duration: number;
  frequency: number;
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
