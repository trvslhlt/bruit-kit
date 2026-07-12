import type { ClockedNoteTarget } from "./noteTarget";

export interface SequencerStep {
  /** Notes to trigger this step; an empty array is a silent rest. */
  notes: number[];
  /** 0-127, applied to every note in this step. */
  velocity: number;
  /** Fraction of this step's duration the notes are held before their
   * noteOff fires — typically 0-1, but not clamped: a value above 1 holds
   * past this step's own slot, e.g. for an explicit-duration trigger mode
   * that outlives the grid position that started it. */
  gate: number;
  /** This step's own length in seconds — the "rhythm": steps don't have to
   * be equal length, so a pattern of e.g. 1, 1.5, 1 seconds just means
   * three steps with those durationSeconds values. */
  durationSeconds: number;
  /** Optional early(-)/late(+) nudge in seconds, applied only to this
   * step's own noteOn/noteOff times — never to the sequencer's grid
   * advance, so a shift is a local nudge around this step's nominal
   * position, not a permanent drift of every step after it. */
  timeShiftSeconds?: number;
}

interface ScheduledStep {
  index: number;
  startTime: number;
  durationSeconds: number;
}

// Short lookahead/poll, same reasoning as arpeggiator.ts: long enough to
// stay ahead of the audio clock without a poll-frequency scheduler, short
// enough that a live edit via setSteps/setSpeed is picked up almost
// immediately rather than after a large pre-scheduled backlog.
const LOOKAHEAD_SECONDS = 0.2;
const POLL_INTERVAL_MS = 50;
const MIN_STEP_SECONDS = 0.01;
// How long to keep entries in the schedule log after they've finished
// sounding, so a UI playhead polling slightly behind real time can still
// resolve "what was playing a moment ago."
const SCHEDULE_LOG_RETENTION_SECONDS = 2;

/** A step-sequencer clock: cycles through `steps`, firing noteOn/noteOff on
 * a ClockedNoteTarget slightly ahead of real time (same lookahead-poll
 * technique as ArpeggiatorEffect and MidiPlaybackController). Unlike
 * MidiPlaybackController, this has an explicit start()/stop() transport
 * rather than reacting to held notes, since a pattern loops indefinitely.
 *
 * Because each step is only scheduled one at a time within the lookahead
 * window (not a whole cycle precomputed upfront), a live setSteps() call
 * takes effect on the very next step with no rescheduling logic needed —
 * simpler than MidiPlaybackController's retime-on-edit dance, which exists
 * only because that class precomputes a whole fixed-duration file's worth
 * of events at once. */
export class StepSequencer {
  private steps: SequencerStep[] = [];
  private speed = 1;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private scheduleLog: ScheduledStep[] = [];

  constructor(private target: ClockedNoteTarget) {}

  /** Replacing the pattern takes effect on the next scheduled step;
   * stepIndex % steps.length means a shrinking/growing pattern never goes
   * out of bounds mid-playback. */
  setSteps(steps: SequencerStep[]): void {
    this.steps = steps;
  }

  /** Scales every step's duration at playback time — e.g. 2 plays the
   * pattern twice as fast — without needing to rewrite each step's own
   * durationSeconds. */
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  isPlaying(): boolean {
    return this.running;
  }

  start(leadIn = 0.05): void {
    if (this.running) return;
    this.running = true;
    this.stepIndex = 0;
    this.nextStepTime = this.target.currentTime + leadIn;
    this.startClock();
  }

  /** Steps already scheduled inside the lookahead window at the moment
   * this is called will still play out — same documented caveat as
   * MidiPlaybackController.stop(). */
  stop(): void {
    this.running = false;
    this.stopClock();
  }

  /** Resolves which step is actually audible at `atTime` (defaults to
   * now), for a UI playhead. This differs from `stepIndex` (the last step
   * *scheduled*) because scheduling runs ahead of real time — a step
   * scheduled just now won't actually sound until its startTime arrives.
   * Looks up a short rolling log of recently-scheduled steps rather than
   * assuming "most recently scheduled" is "currently playing." */
  getCurrentStepIndex(atTime: number = this.target.currentTime): number | null {
    for (let i = this.scheduleLog.length - 1; i >= 0; i--) {
      const entry = this.scheduleLog[i];
      if (
        atTime >= entry.startTime &&
        atTime < entry.startTime + entry.durationSeconds
      ) {
        return entry.index;
      }
    }
    return null;
  }

  private startClock(): void {
    if (this.intervalId !== null) return;
    const fill = () => {
      while (this.nextStepTime - this.target.currentTime < LOOKAHEAD_SECONDS) {
        this.fireStep(this.nextStepTime);
      }
      this.pruneScheduleLog();
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

  private fireStep(atTime: number): void {
    if (this.steps.length === 0) {
      // Nothing to play, but keep nextStepTime tracking real time so a
      // pattern added later doesn't have to fire a stacked-up backlog.
      this.nextStepTime = atTime + POLL_INTERVAL_MS / 1000;
      return;
    }

    const step = this.steps[this.stepIndex % this.steps.length];
    const durationSeconds =
      Math.max(step.durationSeconds, MIN_STEP_SECONDS) /
      Math.max(this.speed, 0.01);

    if (step.notes.length > 0) {
      // The shift only moves *this* step's own noteOn/noteOff times —
      // nextStepTime below still advances from the unshifted atTime, so a
      // shift can't drift the grid position of anything after it. A shift
      // larger than the remaining lookahead margin at the moment this
      // fires simply can't reach further into the past than "now": Web
      // Audio clamps a start()/stop() time that's already elapsed to
      // immediate playback rather than erroring.
      const shiftedAtTime = atTime + (step.timeShiftSeconds ?? 0);
      const gateSeconds = durationSeconds * step.gate;
      for (const note of step.notes) {
        this.target.noteOn(note, step.velocity, shiftedAtTime);
        this.target.noteOff(note, shiftedAtTime + gateSeconds);
      }
    }

    this.scheduleLog.push({
      index: this.stepIndex % this.steps.length,
      startTime: atTime,
      durationSeconds,
    });
    this.stepIndex++;
    this.nextStepTime = atTime + durationSeconds;
  }

  private pruneScheduleLog(): void {
    const cutoff = this.target.currentTime - SCHEDULE_LOG_RETENTION_SECONDS;
    while (
      this.scheduleLog.length > 0 &&
      this.scheduleLog[0].startTime + this.scheduleLog[0].durationSeconds <
        cutoff
    ) {
      this.scheduleLog.shift();
    }
  }
}
