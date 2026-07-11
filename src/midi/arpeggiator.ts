import {
  type ArpParams,
  type HeldNote,
  buildArpSequence,
  pickStep,
} from "./arpPatterns";
import type { ClockedNoteTarget, NoteTarget } from "./noteTarget";

// Short lookahead/poll: unlike a MIDI-loop scheduler (which can tolerate a
// couple of seconds of slack since a "loop" is expected to keep going), an
// arpeggiator needs to feel responsive to key release — a 2s lookahead
// would mean up to ~2s of extra notes firing after you let go.
const LOOKAHEAD_SECONDS = 0.15;
const POLL_INTERVAL_MS = 30;

/** Live-only: cycles through currently-held notes for as long as they're
 * held. This can't be reused for MIDI file playback the way ChordEffect is —
 * an arpeggiator needs to know how long a note will be held before it can
 * generate steps, which for a live key press isn't known until the key is
 * released. File playback already has that information upfront (each
 * note's fixed duration), so it gets a separate implementation in
 * fileTransforms.ts that transforms a whole precomputed event list instead
 * of reacting to live key state. */
export class ArpeggiatorEffect implements NoteTarget {
  private enabled = false;
  private held: HeldNote[] = [];
  private params: ArpParams = {
    rateHz: 8,
    pattern: "up",
    octaves: 1,
    gate: 0.7,
  };
  private stepIndex = 0;
  private nextStepTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private target: ClockedNoteTarget) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.stopClock();
    else if (this.held.length > 0) this.startClock();
  }

  setParams(params: Partial<ArpParams>): void {
    Object.assign(this.params, params);
  }

  noteOn(note: number, velocity: number, time?: number): void {
    if (!this.enabled) {
      this.target.noteOn(note, velocity, time);
      return;
    }
    if (!this.held.some((h) => h.note === note))
      this.held.push({ note, velocity });
    if (this.intervalId === null) {
      this.stepIndex = 0;
      this.nextStepTime = this.target.currentTime + 0.05;
      this.startClock();
    }
  }

  noteOff(note: number, time?: number): void {
    if (!this.enabled) {
      this.target.noteOff(note, time);
      return;
    }
    this.held = this.held.filter((h) => h.note !== note);
    if (this.held.length === 0) this.stopClock();
  }

  private startClock(): void {
    if (this.intervalId !== null) return;
    const fill = () => {
      const stepSeconds = 1 / Math.max(this.params.rateHz, 0.1);
      while (this.nextStepTime - this.target.currentTime < LOOKAHEAD_SECONDS) {
        this.fireStep(this.nextStepTime, stepSeconds);
        this.nextStepTime += stepSeconds;
      }
    };
    fill();
    this.intervalId = setInterval(fill, POLL_INTERVAL_MS);
  }

  private stopClock(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private fireStep(atTime: number, stepSeconds: number): void {
    const sequence = buildArpSequence(
      this.held,
      this.params.pattern,
      this.params.octaves,
    );
    const step = pickStep(sequence, this.params.pattern, this.stepIndex);
    if (!step) return;
    if (this.params.pattern !== "random") this.stepIndex++;
    const gateSeconds = stepSeconds * this.params.gate;
    this.target.noteOn(step.note, step.velocity, atTime);
    this.target.noteOff(step.note, atTime + gateSeconds);
  }
}
