/** MIDI note 69 (A4) = 440Hz, the standard tuning reference — for absolute
 * oscillator/carrier frequencies. */
export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Playback-rate multiplier for pitching a sample up/down by the distance
 * (in semitones) between `note` and the sample's own root note — the same
 * relative-to-a-base-note convention granular-processor.js uses for its
 * rate calculation, just extracted as a standalone function. */
export function semitoneRatio(note: number, rootNote: number): number {
  return 2 ** ((note - rootNote) / 12);
}
