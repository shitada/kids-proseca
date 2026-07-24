import type {
  LaneCount,
  LaneIndex,
  RhythmNote,
} from "./types";
import { isLaneIndex } from "./types";

export interface BeatmapExpansion {
  stageNumber: number;
  laneCount: LaneCount;
  targetDurationSeconds: number;
  bpm: number;
  rootMidi: number;
  baseNotes: readonly RhythmNote[];
}

export function expandBeatmap({
  stageNumber,
  laneCount,
  targetDurationSeconds,
  bpm,
  rootMidi,
  baseNotes,
}: BeatmapExpansion): readonly RhythmNote[] {
  if (baseNotes.length === 0) {
    throw new Error(`Stage ${stageNumber} cannot expand an empty beatmap.`);
  }

  const firstNoteTime = Math.min(...baseNotes.map((note) => note.time));
  const baseEndTime = Math.max(
    ...baseNotes.map((note) => note.time + note.duration),
  );
  const phraseDuration = baseEndTime - firstNoteTime;
  const sectionGap = (60 / bpm) * 2;
  const finalNoteTime = targetDurationSeconds - 3;
  const expanded: RhythmNote[] = [];
  let section = 0;
  let sectionStart = firstNoteTime;

  while (sectionStart <= finalNoteTime) {
    for (const note of baseNotes) {
      const time = sectionStart + (note.time - firstNoteTime);
      if (time + note.duration > finalNoteTime) {
        continue;
      }

      expanded.push({
        ...note,
        id: `stage-${stageNumber}-section-${section + 1}-${note.id}`,
        lane: transformLane(note.lane, laneCount, section),
        time,
        midiNote:
          section % 4 === 3 && note.midiNote < rootMidi + 7
            ? note.midiNote + 12
            : note.midiNote,
      });
    }

    section += 1;
    sectionStart += phraseDuration + sectionGap;
  }

  const cadenceLane = findCadenceLane(
    expanded,
    laneCount,
    finalNoteTime,
  );
  if (cadenceLane !== null) {
    expanded.push({
      id: `stage-${stageNumber}-final-cadence`,
      lane: cadenceLane,
      time: finalNoteTime,
      type: "tap",
      duration: 0,
      midiNote: rootMidi + 12,
    });
  }

  return expanded.sort(
    (left, right) => left.time - right.time || left.lane - right.lane,
  );
}

function transformLane(
  lane: LaneIndex,
  laneCount: LaneCount,
  section: number,
): LaneIndex {
  const transformed =
    section % 3 === 1
      ? laneCount - 1 - lane
      : section % 3 === 2
        ? (lane + 1) % laneCount
        : lane;

  if (
    transformed !== 0 &&
    transformed !== 1 &&
    transformed !== 2 &&
    transformed !== 3 &&
    transformed !== 4 &&
    transformed !== 5
  ) {
    throw new Error(`Expanded lane is outside the supported range: ${transformed}`);
  }
  return transformed;
}

function findCadenceLane(
  notes: readonly RhythmNote[],
  laneCount: LaneCount,
  cadenceTime: number,
): LaneIndex | null {
  for (let lane = 0; lane < laneCount; lane += 1) {
    const occupied = notes.some(
      (note) =>
        note.lane === lane &&
        (Math.abs(note.time - cadenceTime) < 0.001 ||
          (note.type === "hold" &&
            note.time <= cadenceTime &&
            note.time + note.duration >= cadenceTime)),
    );
    if (!occupied && isLaneIndex(lane)) {
      return lane;
    }
  }
  return null;
}
