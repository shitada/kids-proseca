import type {
  EngineUpdate,
  JudgementKind,
  JudgementResult,
  JudgementSummary,
  LaneIndex,
  NoteState,
  RhythmNote,
} from "./types";

export interface JudgementWindows {
  perfect: number;
  good: number;
}

export class JudgementEngine {
  private readonly states: NoteState[];
  private readonly windows: JudgementWindows;
  private perfectCount = 0;
  private goodCount = 0;
  private missedCount = 0;
  private windowScale = 1;
  private readonly holdStartKinds = new Map<string, JudgementKind>();

  constructor(notes: readonly RhythmNote[], windows: JudgementWindows) {
    if (windows.perfect <= 0 || windows.good <= windows.perfect) {
      throw new Error("Judgement windows must be positive and ordered.");
    }

    this.windows = windows;
    this.states = [...notes]
      .sort((left, right) => left.time - right.time)
      .map((note) => ({ note, status: "pending" }));
  }

  hit(lane: LaneIndex, elapsed: number): JudgementResult {
    return this.press(lane, elapsed);
  }

  press(lane: LaneIndex, elapsed: number): JudgementResult {
    let closest: NoteState | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    const goodWindow = this.windows.good * this.windowScale;

    for (const state of this.states) {
      if (state.status !== "pending" || state.note.lane !== lane) {
        continue;
      }

      const distance = Math.abs(elapsed - state.note.time);
      if (distance <= goodWindow && distance < closestDistance) {
        closest = state;
        closestDistance = distance;
      }
    }

    if (!closest) {
      return { kind: "empty", phase: "empty" };
    }

    const offset = elapsed - closest.note.time;
    const kind =
      closestDistance <= this.windows.perfect * this.windowScale
        ? "perfect"
        : "good";

    if (closest.note.type === "hold") {
      closest.status = "holding";
      this.holdStartKinds.set(closest.note.id, kind);
      return { kind, phase: "hold-start", note: closest.note, offset };
    }

    closest.status = "hit";
    this.recordHit(kind);
    return { kind, phase: "tap", note: closest.note, offset };
  }

  release(lane: LaneIndex, elapsed: number): JudgementResult {
    const activeHold = this.states.find(
      (state) => state.status === "holding" && state.note.lane === lane,
    );

    if (!activeHold) {
      return { kind: "empty", phase: "empty" };
    }

    const holdEnd = activeHold.note.time + activeHold.note.duration;
    if (elapsed >= holdEnd - this.windows.good * this.windowScale) {
      return this.completeHold(activeHold, elapsed - holdEnd);
    }

    activeHold.status = "missed";
    this.holdStartKinds.delete(activeHold.note.id);
    this.missedCount += 1;
    return {
      kind: "empty",
      phase: "hold-break",
      note: activeHold.note,
      offset: elapsed - holdEnd,
    };
  }

  collectMisses(elapsed: number): RhythmNote[] {
    return [...this.advance(elapsed).misses];
  }

  advance(elapsed: number): EngineUpdate {
    const misses: RhythmNote[] = [];
    const completedHolds: JudgementResult[] = [];
    const goodWindow = this.windows.good * this.windowScale;

    for (const state of this.states) {
      if (
        state.status === "pending" &&
        elapsed - state.note.time > goodWindow
      ) {
        state.status = "missed";
        this.missedCount += 1;
        misses.push(state.note);
      } else if (
        state.status === "holding" &&
        elapsed >= state.note.time + state.note.duration
      ) {
        completedHolds.push(
          this.completeHold(
            state,
            elapsed - (state.note.time + state.note.duration),
          ),
        );
      }
    }

    return { misses, completedHolds };
  }

  setAssistEnabled(enabled: boolean): void {
    this.windowScale = enabled ? 1.45 : 1;
  }

  getNextPendingLane(elapsed: number, lookAhead: number): LaneIndex | null {
    const next = this.states.find(
      (state) =>
        state.status === "pending" &&
        state.note.time >= elapsed &&
        state.note.time - elapsed <= lookAhead,
    );
    return next?.note.lane ?? null;
  }

  getStates(): readonly NoteState[] {
    return this.states;
  }

  getSummary(): JudgementSummary {
    return {
      perfect: this.perfectCount,
      good: this.goodCount,
      missed: this.missedCount,
      total: this.states.length,
    };
  }

  private completeHold(state: NoteState, offset: number): JudgementResult {
    state.status = "hit";
    const kind = this.holdStartKinds.get(state.note.id) ?? "good";
    this.holdStartKinds.delete(state.note.id);
    this.recordHit(kind);
    return {
      kind,
      phase: "hold-complete",
      note: state.note,
      offset,
    };
  }

  private recordHit(kind: JudgementKind): void {
    if (kind === "perfect") {
      this.perfectCount += 1;
    } else if (kind === "good") {
      this.goodCount += 1;
    }
  }
}
