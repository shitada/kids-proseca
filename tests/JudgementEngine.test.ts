import { describe, expect, it } from "vitest";
import { FIRST_STAGE, STAGES } from "../src/game/config/stages";
import {
  buildDiatonicTriad,
  isMidiInMajorScale,
  midiToFrequency,
  scaleDegreeToMidi,
} from "../src/game/music/MusicTheory";
import { JudgementEngine } from "../src/game/rhythm/JudgementEngine";
import type { RhythmNote } from "../src/game/rhythm/types";
import { ProgressStorage } from "../src/game/storage/ProgressStorage";
import { createLaneLayout } from "../src/game/render/laneLayout";

const notes: readonly RhythmNote[] = [
  { id: "left", lane: 0, time: 1, type: "tap", duration: 0, midiNote: 69 },
  { id: "right", lane: 1, time: 2, type: "tap", duration: 0, midiNote: 76 },
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
      midiNote: 69,
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
      midiNote: 69,
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

  it("judges notes on the sixth lane", () => {
    const engine = new JudgementEngine(
      [
        {
          id: "sixth-lane",
          lane: 5,
          time: 1,
          type: "tap",
          duration: 0,
          midiNote: 72,
        },
      ],
      { perfect: 0.1, good: 0.25 },
    );

    expect(engine.hit(5, 1).kind).toBe("perfect");
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

  describe("STAGES", () => {
    it("defines 15 sequential stages with the planned lane progression", () => {
      expect(STAGES.map((stage) => stage.stageNumber)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      expect(STAGES.map((stage) => stage.laneCount)).toEqual([
        2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      ]);
    });

    it("uses the planned increasing duration curve", () => {
      expect(STAGES.map((stage) => stage.duration)).toEqual([
        35, 38, 41, 44, 47, 50, 54, 58, 62, 66, 70, 74, 78, 84, 90,
      ]);

      for (const stage of STAGES) {
        const lastNoteTime = Math.max(...stage.notes.map((note) => note.time));
        expect(stage.duration - lastNoteTime).toBeGreaterThanOrEqual(2);
        expect(stage.duration - lastNoteTime).toBeLessThanOrEqual(5);
      }
    });

    it("keeps the requested JR, private, and subway balance", () => {
      expect(STAGES.filter((stage) => stage.category === "jr")).toHaveLength(4);
      expect(STAGES.filter((stage) => stage.category === "private")).toHaveLength(
        7,
      );
      expect(STAGES.filter((stage) => stage.category === "subway")).toHaveLength(
        4,
      );
    });

    it("keeps every note and backing chord inside its stage scale", () => {
      for (const stage of STAGES) {
        for (const note of stage.notes) {
          expect(note.lane).toBeLessThan(stage.laneCount);
          expect(isMidiInMajorScale(stage.music.rootMidi, note.midiNote)).toBe(
            true,
          );
        }

        for (const degree of stage.music.chordProgression) {
          for (const midiNote of buildDiatonicTriad(
            stage.music.rootMidi,
            degree,
          )) {
            expect(isMidiInMajorScale(stage.music.rootMidi, midiNote)).toBe(true);
          }
        }
      }
    });
  });

  it("keeps tap notes and backing chords inside the configured scale", () => {
    for (const note of FIRST_STAGE.notes) {
      expect(
        isMidiInMajorScale(FIRST_STAGE.music.rootMidi, note.midiNote),
      ).toBe(true);
    }

    for (const degree of FIRST_STAGE.music.chordProgression) {
      for (const midiNote of buildDiatonicTriad(
        FIRST_STAGE.music.rootMidi,
        degree,
      )) {
        expect(
          isMidiInMajorScale(FIRST_STAGE.music.rootMidi, midiNote),
        ).toBe(true);
      }
    }
  });
});

describe("MusicTheory", () => {
  it("converts A4 MIDI note 69 to 440Hz", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 8);
  });

  describe("createLaneLayout", () => {
    it("centers layouts from two through six lanes", () => {
      for (const laneCount of [2, 3, 4, 5, 6] as const) {
        const layout = createLaneLayout(laneCount);
        expect(layout.positions).toHaveLength(laneCount);
        expect(
          layout.positions.reduce((sum, position) => sum + position, 0),
        ).toBeCloseTo(0, 8);
        expect(layout.trainLength / layout.trainWidth).toBeCloseTo(1.8, 8);
        expect(layout.trainWidth).toBeLessThan(layout.spacing);
      }
    });
  });

  it("builds a major scale without out-of-key notes", () => {
    const rootMidi = 60;
    for (let degree = 0; degree <= 7; degree += 1) {
      expect(
        isMidiInMajorScale(rootMidi, scaleDegreeToMidi(rootMidi, degree)),
      ).toBe(true);
    }
  });
});

describe("ProgressStorage", () => {
  it("unlocks the next stage and persists best results", () => {
    const values = new Map<string, string>();
    const storage = createStorage(values);
    const progress = new ProgressStorage(() => storage);

    expect(progress.load().value.unlockedStage).toBe(1);
    const saved = progress.recordStageResult({
      stageNumber: 1,
      stageId: STAGES[0]?.id ?? "stage-1",
      score: 1200,
      ticket: "silver",
    });

    expect(saved.warning).toBe("");
    expect(saved.value.unlockedStage).toBe(2);
    expect(saved.value.clearedStages).toEqual([1]);
    expect(progress.load().value.bestScores[STAGES[0]?.id ?? "stage-1"]).toBe(
      1200,
    );
  });

  it("migrates the legacy stage-one completion flag", () => {
    const values = new Map<string, string>([
      ["kids-proseca:stage-1-cleared", "true"],
    ]);
    const progress = new ProgressStorage(() => createStorage(values));

    expect(progress.load().value).toMatchObject({
      version: 3,
      unlockedStage: 2,
      clearedStages: [1],
    });
  });

  it("migrates a completed 13-stage V2 save and unlocks stage 14", () => {
    const stageIds = STAGES.slice(0, 13).map((stage) => stage.id);
    const values = new Map<string, string>([
      [
        "kids-proseca:progress-v2",
        JSON.stringify({
          version: 2,
          unlockedStage: 13,
          clearedStages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
          bestScores: { [stageIds[12] ?? "stage-13"]: 9000 },
          bestTickets: { [stageIds[12] ?? "stage-13"]: "gold" },
        }),
      ],
    ]);
    const progress = new ProgressStorage(() => createStorage(values));
    const migrated = progress.load().value;

    expect(migrated.version).toBe(3);
    expect(migrated.unlockedStage).toBe(14);
    expect(migrated.bestScores[stageIds[12] ?? "stage-13"]).toBe(9000);
  });

  it("surfaces blocked storage without stopping progress", () => {
    const progress = new ProgressStorage(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(progress.load().warning).toBe(
      "このブラウザでは きろくを ほぞんできません。ゲームは そのまま あそべます。",
    );
    expect(
      progress.recordStageResult({
        stageNumber: 1,
        stageId: "stage-1",
        score: 100,
        ticket: "bronze",
      }).value.unlockedStage,
    ).toBe(2);
  });

  it("keeps session unlocks when reads work but writes are blocked", () => {
    const values = new Map<string, string>();
    const storage = createStorage(values, true);
    const progress = new ProgressStorage(() => storage);

    progress.recordStageResult({
      stageNumber: 1,
      stageId: "stage-1",
      score: 100,
      ticket: "bronze",
    });

    expect(progress.load().value.unlockedStage).toBe(2);
  });
});

function createStorage(
  values: Map<string, string>,
  rejectWrites = false,
): Storage {
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
      if (rejectWrites) {
        throw new DOMException("Blocked", "QuotaExceededError");
      }
      values.set(key, value);
    },
  };
}
