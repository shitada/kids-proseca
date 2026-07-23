import stageOneBeatmap from "../../assets/beatmaps/stage-1.json";
import type { LaneIndex, NoteType, RhythmNote } from "../rhythm/types";

export interface StageTheme {
  sky: number;
  ground: number;
  train: number;
  accent: number;
}

export interface StageConfig {
  id: string;
  stageNumber: number;
  routeName: string;
  vehicleName: string;
  worldName: string;
  bpm: number;
  duration: number;
  leadTime: number;
  notes: readonly RhythmNote[];
  theme: StageTheme;
  rightsStatus: "placeholder";
}

interface BeatNote {
  beat: number;
  lane: LaneIndex;
  type: NoteType;
  durationBeats: number;
  pitchIndex: number;
}

const melody = [659.25, 783.99, 880, 987.77, 880, 783.99, 698.46, 783.99];
const bpm = 96;
const secondsPerBeat = 60 / bpm;
const beatNotes: readonly BeatNote[] = stageOneBeatmap.notes.map((entry) => {
  if (entry.lane !== 0 && entry.lane !== 1) {
    throw new Error(`Invalid lane in stage-1 beatmap: ${entry.lane}`);
  }
  if (entry.type !== "tap" && entry.type !== "hold") {
    throw new Error(`Invalid note type in stage-1 beatmap: ${entry.type}`);
  }
  if (
    !Number.isFinite(entry.beat) ||
    entry.beat < 0 ||
    !Number.isFinite(entry.durationBeats) ||
    entry.durationBeats < 0
  ) {
    throw new Error("Stage-1 beatmap contains an invalid beat value.");
  }

  return {
    beat: entry.beat,
    lane: entry.lane,
    type: entry.type,
    durationBeats: entry.durationBeats,
    pitchIndex: entry.pitchIndex,
  };
});

const notes: readonly RhythmNote[] = beatNotes.map((entry, index) => ({
  id: `stage-1-note-${index + 1}`,
  lane: entry.lane,
  time: entry.beat * secondsPerBeat,
  type: entry.type,
  duration: entry.durationBeats * secondsPerBeat,
  frequency: melody[entry.pitchIndex % melody.length] ?? melody[0],
}));

export const FIRST_STAGE: StageConfig = {
  id: "green-city-line-placeholder",
  stageNumber: 1,
  routeName: "やまのてせん（かり）",
  vehicleName: "みどりの でんしゃ（かり）",
  worldName: "あさの とうきょう",
  bpm,
  duration: (beatNotes.at(-1)?.beat ?? 39) * secondsPerBeat + 3,
  leadTime: 2.4,
  notes,
  theme: {
    sky: 0x8dd8ff,
    ground: 0x294861,
    train: 0x79bd28,
    accent: 0xffdd57,
  },
  rightsStatus: "placeholder",
};
