export type ChordShapeName =
  | "major"
  | "minor"
  | "sus4"
  | "power"
  | "major7"
  | "minor7"
  | "dom7";

/** Semitone offsets from the root note for each chord voicing. */
export const CHORD_SHAPES: Record<ChordShapeName, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
};
