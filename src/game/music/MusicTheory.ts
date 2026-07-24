export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

export type ScaleDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ChordDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface StageMusicConfig {
  keyName: string;
  rootMidi: number;
  melodyDegrees: readonly ScaleDegree[];
  chordProgression: readonly ChordDegree[];
  melodyWave: OscillatorType;
  padWave: OscillatorType;
}

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

export function scaleDegreeToMidi(
  rootMidi: number,
  degree: number,
): number {
  if (!Number.isInteger(degree) || degree < 0) {
    throw new Error(`Scale degree must be a non-negative integer: ${degree}`);
  }

  const octave = Math.floor(degree / MAJOR_SCALE_INTERVALS.length);
  const scaleIndex = degree % MAJOR_SCALE_INTERVALS.length;
  const interval = MAJOR_SCALE_INTERVALS[scaleIndex];
  if (interval === undefined) {
    throw new Error(`Scale interval was not found for degree: ${degree}`);
  }

  return rootMidi + octave * 12 + interval;
}

export function buildDiatonicTriad(
  rootMidi: number,
  chordDegree: ChordDegree,
): readonly [number, number, number] {
  return [
    scaleDegreeToMidi(rootMidi, chordDegree),
    scaleDegreeToMidi(rootMidi, chordDegree + 2),
    scaleDegreeToMidi(rootMidi, chordDegree + 4),
  ];
}

export function isMidiInMajorScale(
  rootMidi: number,
  midiNote: number,
): boolean {
  const pitchClass = ((midiNote - rootMidi) % 12 + 12) % 12;
  return MAJOR_SCALE_INTERVALS.some((interval) => interval === pitchClass);
}

export function isScaleDegree(value: number): value is ScaleDegree {
  return Number.isInteger(value) && value >= 0 && value <= 7;
}

