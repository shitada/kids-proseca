import stageOneBeatmap from "../../assets/beatmaps/stage-1.json";
import stageTwoBeatmap from "../../assets/beatmaps/stage-2.json";
import stageThreeBeatmap from "../../assets/beatmaps/stage-3.json";
import stageFourBeatmap from "../../assets/beatmaps/stage-4.json";
import stageFiveBeatmap from "../../assets/beatmaps/stage-5.json";
import stageSixBeatmap from "../../assets/beatmaps/stage-6.json";
import stageSevenBeatmap from "../../assets/beatmaps/stage-7.json";
import stageEightBeatmap from "../../assets/beatmaps/stage-8.json";
import stageNineBeatmap from "../../assets/beatmaps/stage-9.json";
import stageTenBeatmap from "../../assets/beatmaps/stage-10.json";
import stageElevenBeatmap from "../../assets/beatmaps/stage-11.json";
import stageTwelveBeatmap from "../../assets/beatmaps/stage-12.json";
import stageThirteenBeatmap from "../../assets/beatmaps/stage-13.json";
import {
  isScaleDegree,
  scaleDegreeToMidi,
  type StageMusicConfig,
} from "../music/MusicTheory";
import {
  isLaneIndex,
  type LaneCount,
  type NoteType,
  type RhythmNote,
} from "../rhythm/types";

export type StageCategory = "jr" | "private" | "subway";
export type StageEnvironment =
  | "city"
  | "tram"
  | "retro-subway"
  | "bay"
  | "river"
  | "sunset"
  | "coast"
  | "red-subway"
  | "mountain"
  | "starry"
  | "green-suburb"
  | "deep-subway"
  | "finale";

export interface StageTheme {
  sky: number;
  ground: number;
  train: number;
  accent: number;
}

export interface StageConfig {
  id: string;
  stageNumber: number;
  category: StageCategory;
  routeName: string;
  vehicleName: string;
  worldName: string;
  laneCount: LaneCount;
  environment: StageEnvironment;
  bpm: number;
  duration: number;
  leadTime: number;
  notes: readonly RhythmNote[];
  theme: StageTheme;
  music: StageMusicConfig;
  rightsStatus: "placeholder";
}

interface StageDefinition
  extends Omit<StageConfig, "duration" | "notes" | "rightsStatus"> {
  beatmap: unknown;
}

const melodyDegrees = [0, 2, 4, 5, 4, 2, 1, 2] as const;
const chordProgression = [0, 4, 5, 3] as const;

function music(
  keyName: string,
  rootMidi: number,
  melodyWave: OscillatorType,
  padWave: OscillatorType,
): StageMusicConfig {
  return {
    keyName,
    rootMidi,
    melodyDegrees,
    chordProgression,
    melodyWave,
    padWave,
  };
}

const DEFINITIONS: readonly StageDefinition[] = [
  {
    id: "yamanote-city",
    stageNumber: 1,
    category: "jr",
    routeName: "JR やまのてせん",
    vehicleName: "E235けい モチーフ",
    worldName: "あさの とうきょう",
    laneCount: 2,
    environment: "city",
    bpm: 92,
    leadTime: 2.4,
    beatmap: stageOneBeatmap,
    music: music("C major", 60, "sine", "sine"),
    theme: { sky: 0x8dd8ff, ground: 0x294861, train: 0x79bd28, accent: 0xffdd57 },
  },
  {
    id: "sakura-tram",
    stageNumber: 2,
    category: "private",
    routeName: "とうきょう さくらトラム",
    vehicleName: "9000がた モチーフ",
    worldName: "はなの したまち",
    laneCount: 2,
    environment: "tram",
    bpm: 98,
    leadTime: 2.35,
    beatmap: stageTwoBeatmap,
    music: music("F major", 65, "sine", "triangle"),
    theme: { sky: 0xffd9e8, ground: 0x52734d, train: 0x8d3f5f, accent: 0xfff0a6 },
  },
  {
    id: "ginza-retro",
    stageNumber: 3,
    category: "subway",
    routeName: "メトロ ぎんざせん",
    vehicleName: "1000けい モチーフ",
    worldName: "レトロな ちかてつ",
    laneCount: 2,
    environment: "retro-subway",
    bpm: 104,
    leadTime: 2.3,
    beatmap: stageThreeBeatmap,
    music: music("G major", 67, "triangle", "sine"),
    theme: { sky: 0x30274a, ground: 0x1d1b2f, train: 0xf3a712, accent: 0xffe49a },
  },
  {
    id: "yurikamome-bay",
    stageNumber: 4,
    category: "private",
    routeName: "ゆりかもめ",
    vehicleName: "7500けい モチーフ",
    worldName: "うみと にじのはし",
    laneCount: 3,
    environment: "bay",
    bpm: 108,
    leadTime: 2.25,
    beatmap: stageFourBeatmap,
    music: music("D major", 62, "sine", "sine"),
    theme: { sky: 0x82d9ff, ground: 0x2c6d8f, train: 0x3f8fc4, accent: 0xe8fbff },
  },
  {
    id: "sobu-river",
    stageNumber: 5,
    category: "jr",
    routeName: "JR ちゅうおう・そうぶせん",
    vehicleName: "E231けい モチーフ",
    worldName: "きいろい まちと かわ",
    laneCount: 3,
    environment: "river",
    bpm: 112,
    leadTime: 2.2,
    beatmap: stageFiveBeatmap,
    music: music("B-flat major", 58, "triangle", "sine"),
    theme: { sky: 0xb9e7ff, ground: 0x426b73, train: 0xf2d338, accent: 0xffffff },
  },
  {
    id: "toyoko-sunset",
    stageNumber: 6,
    category: "private",
    routeName: "とうきゅう とうよこせん",
    vehicleName: "5050けい モチーフ",
    worldName: "かわべの ゆうやけ",
    laneCount: 3,
    environment: "sunset",
    bpm: 116,
    leadTime: 2.15,
    beatmap: stageSixBeatmap,
    music: music("A major", 57, "triangle", "triangle"),
    theme: { sky: 0xffaa7a, ground: 0x594a64, train: 0xd7263d, accent: 0xffe1c4 },
  },
  {
    id: "keikyu-coast",
    stageNumber: 7,
    category: "private",
    routeName: "けいきゅう ほんせん",
    vehicleName: "しん1000がた モチーフ",
    worldName: "うみかぜ かいそく",
    laneCount: 4,
    environment: "coast",
    bpm: 120,
    leadTime: 2.1,
    beatmap: stageSevenBeatmap,
    music: music("E major", 64, "square", "triangle"),
    theme: { sky: 0x75d2ff, ground: 0x23556d, train: 0xd62828, accent: 0xffffff },
  },
  {
    id: "marunouchi-red",
    stageNumber: 8,
    category: "subway",
    routeName: "メトロ まるのうちせん",
    vehicleName: "2000けい モチーフ",
    worldName: "あかい ちかとし",
    laneCount: 4,
    environment: "red-subway",
    bpm: 124,
    leadTime: 2.05,
    beatmap: stageEightBeatmap,
    music: music("E-flat major", 63, "triangle", "sine"),
    theme: { sky: 0x3d1f2c, ground: 0x24151d, train: 0xd71920, accent: 0xffd4d4 },
  },
  {
    id: "odakyu-mountain",
    stageNumber: 9,
    category: "private",
    routeName: "おだきゅう おだわらせん",
    vehicleName: "ロマンスカーGSE モチーフ",
    worldName: "もりと はこねの やま",
    laneCount: 4,
    environment: "mountain",
    bpm: 128,
    leadTime: 2,
    beatmap: stageNineBeatmap,
    music: music("C major", 60, "sine", "triangle"),
    theme: { sky: 0x9ed9f5, ground: 0x315b3a, train: 0xc6423e, accent: 0xffe0a8 },
  },
  {
    id: "keio-starry",
    stageNumber: 10,
    category: "private",
    routeName: "けいおうせん",
    vehicleName: "5000けい モチーフ",
    worldName: "たかおの ほしぞら",
    laneCount: 5,
    environment: "starry",
    bpm: 132,
    leadTime: 1.95,
    beatmap: stageTenBeatmap,
    music: music("G major", 55, "triangle", "sine"),
    theme: { sky: 0x171c47, ground: 0x1b3340, train: 0x934f9e, accent: 0xf8edff },
  },
  {
    id: "seibu-green",
    stageNumber: 11,
    category: "private",
    routeName: "せいぶ いけぶくろせん",
    vehicleName: "40000けい モチーフ",
    worldName: "みどりの こうがい",
    laneCount: 5,
    environment: "green-suburb",
    bpm: 136,
    leadTime: 1.9,
    beatmap: stageElevenBeatmap,
    music: music("D major", 62, "square", "triangle"),
    theme: { sky: 0xa8dcce, ground: 0x35594a, train: 0x4a9b62, accent: 0xf3df45 },
  },
  {
    id: "oedo-deep",
    stageNumber: 12,
    category: "subway",
    routeName: "とえい おおえどせん",
    vehicleName: "12-600がた モチーフ",
    worldName: "ちてい だいめいろ",
    laneCount: 5,
    environment: "deep-subway",
    bpm: 140,
    leadTime: 1.85,
    beatmap: stageTwelveBeatmap,
    music: music("F major", 53, "square", "sine"),
    theme: { sky: 0x211a38, ground: 0x171326, train: 0xb23a8a, accent: 0x9ff3ff },
  },
  {
    id: "chuo-finale",
    stageNumber: 13,
    category: "jr",
    routeName: "JR ちゅうおうせん かいそく",
    vehicleName: "E233けい モチーフ",
    worldName: "とうきょう おんがくパレード",
    laneCount: 6,
    environment: "finale",
    bpm: 146,
    leadTime: 1.8,
    beatmap: stageThirteenBeatmap,
    music: music("C major", 60, "square", "triangle"),
    theme: { sky: 0xffb35c, ground: 0x4b4255, train: 0xf07f13, accent: 0xfff4a8 },
  },
];

export const STAGES: readonly StageConfig[] = DEFINITIONS.map((definition) => {
  const notes = parseBeatmap(
    definition.beatmap,
    definition.stageNumber,
    definition.laneCount,
    definition.bpm,
    definition.music,
  );
  const lastNoteEnd = notes.reduce(
    (latest, note) => Math.max(latest, note.time + note.duration),
    0,
  );

  return {
    ...definition,
    duration: lastNoteEnd + 3,
    notes,
    rightsStatus: "placeholder",
  };
});

export const FIRST_STAGE = STAGES[0];

export function getStage(stageNumber: number): StageConfig | undefined {
  return STAGES.find((stage) => stage.stageNumber === stageNumber);
}

function parseBeatmap(
  rawBeatmap: unknown,
  stageNumber: number,
  laneCount: LaneCount,
  bpm: number,
  stageMusic: StageMusicConfig,
): readonly RhythmNote[] {
  if (!isRecord(rawBeatmap) || !Array.isArray(rawBeatmap.notes)) {
    throw new Error(`Stage ${stageNumber} beatmap must contain a notes array.`);
  }

  const secondsPerBeat = 60 / bpm;
  let previousBeat = Number.NEGATIVE_INFINITY;

  return rawBeatmap.notes.map((rawNote, index) => {
    if (!isRecord(rawNote)) {
      throw new Error(`Stage ${stageNumber} note ${index + 1} is invalid.`);
    }

    const beat = rawNote.beat;
    const lane = rawNote.lane;
    const type = rawNote.type;
    const durationBeats = rawNote.durationBeats;
    const scaleDegree = rawNote.scaleDegree;

    if (typeof beat !== "number" || !Number.isFinite(beat) || beat < 0) {
      throw new Error(`Stage ${stageNumber} note ${index + 1} has an invalid beat.`);
    }
    if (beat < previousBeat) {
      throw new Error(`Stage ${stageNumber} beatmap must be sorted by beat.`);
    }
    if (
      typeof lane !== "number" ||
      !isLaneIndex(lane) ||
      lane >= laneCount
    ) {
      throw new Error(`Stage ${stageNumber} note ${index + 1} has an invalid lane.`);
    }
    if (type !== "tap" && type !== "hold") {
      throw new Error(`Stage ${stageNumber} note ${index + 1} has an invalid type.`);
    }
    if (
      typeof durationBeats !== "number" ||
      !Number.isFinite(durationBeats) ||
      durationBeats < 0 ||
      (type === "hold" && durationBeats <= 0)
    ) {
      throw new Error(`Stage ${stageNumber} note ${index + 1} has an invalid duration.`);
    }
    if (typeof scaleDegree !== "number" || !isScaleDegree(scaleDegree)) {
      throw new Error(`Stage ${stageNumber} note ${index + 1} has an invalid scale degree.`);
    }

    previousBeat = beat;
    return {
      id: `stage-${stageNumber}-note-${index + 1}`,
      lane,
      time: beat * secondsPerBeat,
      type: type satisfies NoteType,
      duration: durationBeats * secondsPerBeat,
      midiNote: scaleDegreeToMidi(stageMusic.rootMidi, scaleDegree),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
