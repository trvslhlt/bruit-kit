import type { NoteTarget } from "./noteTarget";
import type { StepClock } from "./stepClock";

export interface TrackStep {
  /** Notes to trigger this step; an empty array is a silent rest. */
  notes: number[];
  /** 0-127, applied to every note in this step. */
  velocity: number;
  /** Fraction of the shared clock's step length the notes are held before
   * their noteOff fires — typically 0-1, but not clamped: a value above 1
   * holds past this step's own slot (an explicit-duration trigger mode). */
  gate: number;
  /** Optional early(-)/late(+) nudge in seconds, applied only to this
   * step's own noteOn/noteOff times — never to the clock's grid advance,
   * so a shift is a local nudge, not a permanent drift of every step
   * after it. Same semantics as SequencerStep.timeShiftSeconds. */
  timeShiftSeconds?: number;
}

/** Note the deliberate absence of durationSeconds here, unlike
 * SequencerStep: a track's step length is owned by the shared clock (every
 * row must agree on column width for a grid to line up), not by the step
 * itself. */

/** Subscribes one row/track (a NoteTarget plus a live step-array getter)
 * to a shared StepClock, firing that row's notes on each tick with the
 * same gate/timeShift semantics as StepSequencer.fireStep — this is the
 * multi-row counterpart to StepSequencer, sharing one clock instead of
 * each row owning its own (see stepClock.ts's doc comment for why that
 * matters). `getSteps` is read fresh on every tick, so replacing the
 * pattern (or returning an all-rest pattern to mute the row without
 * unsubscribing) takes effect on the very next step. */
export function createStepTrack(
  target: NoteTarget,
  clock: StepClock,
  getSteps: () => TrackStep[],
): { unsubscribe(): void } {
  const unsubscribe = clock.onTick((stepIndex, atTime, stepSeconds) => {
    const steps = getSteps();
    if (steps.length === 0) return;

    const step = steps[stepIndex % steps.length];
    if (step.notes.length === 0) return;

    const shiftedAtTime = atTime + (step.timeShiftSeconds ?? 0);
    const gateSeconds = stepSeconds * step.gate;
    for (const note of step.notes) {
      target.noteOn(note, step.velocity, shiftedAtTime);
      target.noteOff(note, shiftedAtTime + gateSeconds);
    }
  });

  return { unsubscribe };
}
