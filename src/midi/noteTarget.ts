// The foundational abstraction the rest of this MIDI toolkit is built on:
// anything with a plain noteOn/noteOff pair can be driven by a MIDI file
// player, a chord/arpeggiator effect, or a manual keyboard — none of that
// code needs to know what's actually generating sound on the other end of
// the call (a synth, a sampler, anything).

export interface NoteEvent {
  time: number;
  type: "noteOn" | "noteOff";
  note: number;
  velocity?: number;
}

export interface NoteTarget {
  noteOn(note: number, velocity: number, time?: number): void;
  noteOff(note: number, time?: number): void;
}

/** A NoteTarget that also exposes its own clock — needed by anything that
 * schedules its own future events relative to "now" (MIDI file playback,
 * a live arpeggiator), as opposed to code that just forwards whatever time
 * it was already given. */
export interface ClockedNoteTarget extends NoteTarget {
  currentTime: number;
}
