import { CHORD_SHAPES, type ChordShapeName } from "./chordShapes";
import type { NoteTarget } from "./noteTarget";

// Stateless per-event transform: turns one note into a full chord voicing.
// It never depends on the wall clock — it just reacts to whatever timestamp
// is already attached to a noteOn/noteOff call — so the same logic works
// whether that timestamp is "now" (live keyboard) or a precomputed future
// time (MIDI file playback). The file-playback path doesn't actually route
// through this class, though: a stateful file playback controller schedules
// whole batches of events at once rather than one call at a time, so it
// would use its own copy of this same transform on note intervals instead
// (see fileTransforms.ts's applyChordToIntervals) — both share CHORD_SHAPES.
export class ChordEffect implements NoteTarget {
  private enabled = false;
  private shape: ChordShapeName = "major";
  // root note -> the chord-tone notes it turned into, so noteOff releases
  // exactly what noteOn started even if the shape changes in between.
  private soundingNotes = new Map<number, number[]>();

  constructor(private target: NoteTarget) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setShape(shape: ChordShapeName): void {
    this.shape = shape;
  }

  noteOn(note: number, velocity: number, time?: number): void {
    if (!this.enabled) {
      this.target.noteOn(note, velocity, time);
      return;
    }
    const notes = CHORD_SHAPES[this.shape].map((offset) => note + offset);
    this.soundingNotes.set(note, notes);
    for (const n of notes) this.target.noteOn(n, velocity, time);
  }

  noteOff(note: number, time?: number): void {
    const notes = this.soundingNotes.get(note);
    if (!notes) {
      this.target.noteOff(note, time);
      return;
    }
    this.soundingNotes.delete(note);
    for (const n of notes) this.target.noteOff(n, time);
  }
}
