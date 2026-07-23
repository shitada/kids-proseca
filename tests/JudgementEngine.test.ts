import { describe, expect, it } from "vitest";
import { FIRST_STAGE } from "../src/game/config/stages";
import { JudgementEngine } from "../src/game/rhythm/JudgementEngine";
import type { RhythmNote } from "../src/game/rhythm/types";
import { ProgressStorage } from "../src/game/storage/ProgressStorage";

const notes: readonly RhythmNote[] = [
  { id: "left", lane: 0, time: 1, type: "tap", duration: 0, frequency: 440 },
  { id: "right", lane: 1, time: 2, type: "tap", duration: 0, frequency: 660 },
];

describe("JudgementEngine", () => {
  it("marks a close tap as perfect", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    const result = engine.hit(0, 1.07);

    expect(result.kind).toBe("perfect");
    expect(result.note?.id).toBe("left");
    expect(engine.getSummary().perfect).toBe(1);
  });

  it("marks a wider tap as good", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    const result = engine.hit(1, 2.2);

    expect(result.kind).toBe("good");
    expect(engine.getSummary().good).toBe(1);
  });

  it("does not consume a note from the other lane", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    expect(engine.hit(1, 1).kind).toBe("empty");
    expect(engine.hit(0, 1).kind).toBe("perfect");
  });

  it("does not score the same note twice", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    expect(engine.hit(0, 1).kind).toBe("perfect");
    expect(engine.hit(0, 1).kind).toBe("empty");
  });

  it("collects overdue notes as misses once", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    expect(engine.collectMisses(1.3).map((note) => note.id)).toEqual(["left"]);
    expect(engine.collectMisses(1.4)).toEqual([]);
    expect(engine.getSummary().missed).toBe(1);
  });

  it("completes a hold note after it stays pressed through its duration", () => {
    const holdNote: RhythmNote = {
      id: "hold",
      lane: 0,
      time: 1,
      type: "hold",
      duration: 1,
      frequency: 440,
    };
    const engine = new JudgementEngine([holdNote], {
      perfect: 0.1,
      good: 0.25,
    });

    expect(engine.press(0, 1).phase).toBe("hold-start");
    const update = engine.advance(2);

    expect(update.completedHolds).toHaveLength(1);
    expect(update.completedHolds[0]?.phase).toBe("hold-complete");
    expect(engine.getSummary().perfect).toBe(1);
  });

  it("marks a hold note missed when it is released early", () => {
    const holdNote: RhythmNote = {
      id: "hold",
      lane: 1,
      time: 1,
      type: "hold",
      duration: 1,
      frequency: 440,
    };
    const engine = new JudgementEngine([holdNote], {
      perfect: 0.1,
      good: 0.25,
    });

    engine.press(1, 1);
    expect(engine.release(1, 1.4).phase).toBe("hold-break");
    expect(engine.getSummary().missed).toBe(1);
  });

  it("widens the timing window while assist is enabled", () => {
    const engine = new JudgementEngine(notes, { perfect: 0.1, good: 0.25 });

    expect(engine.hit(0, 1.3).kind).toBe("empty");
    engine.setAssistEnabled(true);
    expect(engine.hit(0, 1.3).kind).toBe("good");
  });
});

describe("FIRST_STAGE", () => {
  it("contains a sorted beatmap within the stage duration", () => {
    const times = FIRST_STAGE.notes.map((note) => note.time);
    const lastTime = times.at(-1) ?? 0;

    expect(times).toEqual([...times].sort((left, right) => left - right));
    expect(FIRST_STAGE.notes.length).toBeGreaterThan(20);
    expect(lastTime).toBeLessThan(FIRST_STAGE.duration);
  });
});

describe("ProgressStorage", () => {
  it("persists the first-stage completion flag", () => {
    const values = new Map<string, string>();
    const storage = createStorage(values);
    const progress = new ProgressStorage(() => storage);

    expect(progress.readStageOneCleared().value).toBe(false);
    expect(progress.saveStageOneCleared().warning).toBe("");
    expect(progress.readStageOneCleared().value).toBe(true);
  });

  it("surfaces blocked storage without stopping progress", () => {
    const progress = new ProgressStorage(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(progress.readStageOneCleared()).toEqual({
      value: false,
      warning:
        "このブラウザでは きろくを ほぞんできません。ゲームは そのまま あそべます。",
    });
    expect(progress.saveStageOneCleared().value).toBe(true);
  });
});

function createStorage(values: Map<string, string>): Storage {
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
