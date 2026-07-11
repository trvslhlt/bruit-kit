import { Midi } from "@tonejs/midi";
import type { ArpParams } from "./arpPatterns";
import type { ChordShapeName } from "./chordShapes";
import {
  type ChordParams,
  type FileArpParams,
  type NoteInterval,
  applyArpToIntervals,
  applyChordToIntervals,
  intervalsToNoteEvents,
} from "./fileTransforms";
import type { ClockedNoteTarget, NoteEvent, NoteTarget } from "./noteTarget";

// This module knows about MIDI files; it does not know about the synth's
// internals. It only depends on the small NoteTarget shape (noteOn/noteOff),
// optionally widened to BatchNoteTarget for bulk scheduling efficiency —
// either way, the synth is just a caller-supplied target, not something this
// module owns.

export interface BatchNoteTarget extends NoteTarget {
  scheduleEvents(events: NoteEvent[]): void;
}

function hasScheduleEvents(target: NoteTarget): target is BatchNoteTarget {
  return (
    typeof (target as Partial<BatchNoteTarget>).scheduleEvents === "function"
  );
}

function dispatchEvents(target: NoteTarget, events: NoteEvent[]): void {
  if (hasScheduleEvents(target)) {
    target.scheduleEvents(events);
    return;
  }
  for (const ev of events) {
    if (ev.type === "noteOn")
      target.noteOn(ev.note, ev.velocity ?? 100, ev.time);
    else target.noteOff(ev.note, ev.time);
  }
}

export async function loadMidiFile(arrayBuffer: ArrayBuffer): Promise<Midi> {
  return new Midi(arrayBuffer);
}

export function midiDurationSeconds(midi: Midi): number {
  return midi.duration;
}

function notesToIntervals(midi: Midi): NoteInterval[] {
  const intervals: NoteInterval[] = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      intervals.push({
        start: note.time,
        end: note.time + note.duration,
        note: note.midi,
        velocity: Math.round(note.velocity * 127),
      });
    }
  }
  return intervals;
}

const LOOP_LOOKAHEAD_SECONDS = 2;
const LOOP_POLL_INTERVAL_MS = 500;

/** Stateful MIDI file player supporting live loop/speed/chord/arp changes
 * while playing — plain functions couldn't do this because once notes are
 * scheduled as absolute AudioContext times, changing your mind later means
 * recomputing "where in the file are we right now" and rescheduling the
 * remainder, not just changing a value read once at Play time.
 *
 * `speed` scales the file's own timeline only — pitch is assumed to come
 * from note number independent of tempo (true for any note-number-driven
 * synth), so speeding this up or down is a pure time-stretch with no pitch
 * shift, unlike speeding up a recording.
 *
 * Chord and Arpeggiator are applied as preprocessing transforms on the
 * file's note intervals (see fileTransforms.ts) rather than live NoteTarget
 * wrappers like a manual keyboard would use — a file's notes already have
 * fixed start/end times, so both effects can be computed once up front
 * instead of reacting to live state.
 *
 * Looping stays a couple of cycles ahead of playback via a plain
 * `setInterval`, which is fine even though JS timers are imprecise: the
 * actual trigger timing comes from the absolute AudioContext times baked
 * into each event, not from this timer's accuracy. One consequence: turning
 * Loop off can still let an already-pre-scheduled next cycle play out (up
 * to ~2s worth) before playback actually stops looping.
 */
export class MidiPlaybackController {
  private midi: Midi | null = null;
  private rawIntervals: NoteInterval[] = [];
  private baseEvents: NoteEvent[] = [];
  private duration = 0;
  private speed = 1;
  private loop = false;
  private running = false;

  private chordParams: ChordParams = { enabled: false, shape: "major" };
  private arpParams: FileArpParams = {
    enabled: false,
    rateHz: 8,
    pattern: "up",
    octaves: 1,
    gate: 0.7,
  };

  // cycleStartTime is the AudioContext time that corresponds to file-time
  // cycleStartFileTime — i.e. "when, in real time, did the file-position we
  // most recently restarted from occur." Recomputed on every retime so a
  // live speed/chord/arp change can pick up from the correct spot instead of
  // jumping back to the start.
  private cycleStartTime = 0;
  private cycleStartFileTime = 0;
  private nextLoopStart = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private target: ClockedNoteTarget) {}

  isPlaying(): boolean {
    return this.running;
  }

  /** Fraction (0..1) of the file's duration currently playing, for driving a
   * UI playhead marker. Wraps within [0,1) while looping; clamps to 1 once a
   * non-looping file has finished (isPlaying() has no way to detect "played
   * through" on its own — see the class doc above). */
  getPositionFraction(): number {
    if (!this.running || this.duration <= 0) return 0;
    const t = this.currentFileTime();
    if (this.loop) {
      const wrapped = t % this.duration;
      return (wrapped < 0 ? wrapped + this.duration : wrapped) / this.duration;
    }
    return Math.min(Math.max(t / this.duration, 0), 1);
  }

  start(midi: Midi, speed: number, loop: boolean, leadIn = 0.1): void {
    this.stopLookaheadTimer();
    this.midi = midi;
    this.rawIntervals = notesToIntervals(midi);
    this.duration = midi.duration;
    this.rebuildBaseEvents();
    this.speed = speed;
    this.loop = loop;
    this.running = true;
    this.cycleStartFileTime = 0;
    this.cycleStartTime = this.target.currentTime + leadIn;
    this.scheduleFrom(this.cycleStartFileTime, this.cycleStartTime);
    this.advanceNextLoopStart();
    if (this.loop) this.startLookaheadTimer();
  }

  stop(): void {
    this.running = false;
    this.stopLookaheadTimer();
  }

  setLoop(enabled: boolean): void {
    this.loop = enabled;
    if (!this.running) return;
    if (enabled) this.startLookaheadTimer();
    else this.stopLookaheadTimer();
  }

  /** Retimes playback to continue from its current position at a new
   * speed. The caller is expected to hard-cut any currently-sounding voices
   * right before calling this — a note that was mid-sustain under the old
   * speed has no correctly-timed noteOff left to receive once we jump to
   * the new timeline, so without a clear it would hang forever. This makes
   * every speed tweak a brief re-trigger rather than a seamless crossfade —
   * a deliberate simplicity trade-off. */
  setSpeed(newSpeed: number): void {
    if (!this.running || !this.midi) {
      this.speed = newSpeed;
      return;
    }
    const elapsed = this.currentFileTime();
    this.speed = newSpeed;
    this.retimeFrom(elapsed);
  }

  /** Chord/arp setters share the same hard-cut caveat as setSpeed: the
   * caller should hard-cut currently-sounding voices immediately before
   * invoking these while playing, since a note already sounding under the
   * old shape has no matching noteOff in the regenerated event list
   * otherwise. */
  setChordEnabled(enabled: boolean): void {
    this.chordParams.enabled = enabled;
    this.applyEffectChange();
  }

  setChordShape(shape: ChordShapeName): void {
    this.chordParams.shape = shape;
    this.applyEffectChange();
  }

  setArpEnabled(enabled: boolean): void {
    this.arpParams.enabled = enabled;
    this.applyEffectChange();
  }

  setArpParams(params: Partial<ArpParams>): void {
    Object.assign(this.arpParams, params);
    this.applyEffectChange();
  }

  private applyEffectChange(): void {
    if (!this.midi) return;
    if (!this.running) {
      this.rebuildBaseEvents();
      return;
    }
    const elapsed = this.currentFileTime();
    this.rebuildBaseEvents();
    this.retimeFrom(elapsed);
  }

  private rebuildBaseEvents(): void {
    let intervals = this.rawIntervals;
    intervals = applyChordToIntervals(intervals, this.chordParams);
    intervals = applyArpToIntervals(intervals, this.arpParams);
    this.baseEvents = intervalsToNoteEvents(intervals);
  }

  private currentFileTime(): number {
    return (
      this.cycleStartFileTime +
      (this.target.currentTime - this.cycleStartTime) * this.speed
    );
  }

  private retimeFrom(fileTime: number): void {
    const atEnd = !this.loop && fileTime >= this.duration;
    this.stopLookaheadTimer();
    if (atEnd) return; // nothing left to play; state is already updated for next Play

    this.cycleStartFileTime = this.loop ? fileTime % this.duration : fileTime;
    this.cycleStartTime = this.target.currentTime;
    this.scheduleFrom(this.cycleStartFileTime, this.cycleStartTime);
    this.advanceNextLoopStart();
    if (this.loop) this.startLookaheadTimer();
  }

  private advanceNextLoopStart(): void {
    this.nextLoopStart =
      this.cycleStartTime +
      (this.duration - this.cycleStartFileTime) / this.speed;
  }

  private scheduleFrom(fileTimeStart: number, atRealTime: number): void {
    const events = this.baseEvents
      .filter((ev) => ev.time >= fileTimeStart)
      .map((ev) => ({
        ...ev,
        time: atRealTime + (ev.time - fileTimeStart) / this.speed,
      }));
    dispatchEvents(this.target, events);
  }

  private startLookaheadTimer(): void {
    if (this.intervalId !== null) return;
    const fill = () => {
      while (
        this.nextLoopStart - this.target.currentTime <
        LOOP_LOOKAHEAD_SECONDS
      ) {
        this.scheduleFrom(0, this.nextLoopStart);
        this.nextLoopStart += this.duration / this.speed;
      }
    };
    fill();
    this.intervalId = setInterval(fill, LOOP_POLL_INTERVAL_MS);
  }

  private stopLookaheadTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
