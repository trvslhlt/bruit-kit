// Schedules a multi-point breakpoint curve (built by ui/automationEditor.ts,
// or any {position, value}[] shaped the same way) onto a real AudioParam
// over time. Deliberately independent of the LFO engine's ModulationTarget/
// target-registry pattern (modulation/lfoEngine.ts): that solves "pick one
// of many params from a dropdown for periodic modulation," which isn't
// this module's problem — an automation curve is normally built for one
// specific, already-known param, not chosen from a list.

// Duplicated (not imported) from ui/automationEditor.ts's identical shape,
// deliberately — ui/ and audio/ stay independently importable, with no
// cross-part dependency between them.
export interface AutomationPoint {
  position: number;
  value: number;
}

export interface AutomationValueRange {
  min: number;
  max: number;
}

const DEFAULT_VALUE_RANGE: AutomationValueRange = { min: 0, max: 1 };

/** Schedules `points` (position 0..1 mapped across `durationSeconds`, value
 * 0..1 remapped into `valueRange`) as a ramp onto `param`, anchoring at
 * whatever the scheduled curve actually reaches by the start time first so
 * this doesn't click if a previous schedule's tail hasn't finished yet.
 * One-shot — call again (or use startAutomationLoop) to repeat it.
 *
 * `atTime` lets a lookahead scheduler (anything that computes a future
 * note-start time itself, rather than firing right when it's called) pin
 * the curve's start there instead of "now" — defaults to
 * `audioContext.currentTime` for immediate scheduling, the original
 * behavior. The anchor uses `cancelAndHoldAtTime`, not a synchronous
 * `param.value` read: for a future `atTime`, `.value` reflects whatever
 * the param was *before* any still-pending scheduled automation has
 * actually played (real audio time hasn't reached it yet), not what that
 * automation will have produced by `atTime` -- anchoring on that stale
 * snapshot plants a wrong `setValueAtTime`, silently overriding the real
 * curve with a hard jump instead of the smooth handoff this is meant to
 * guarantee. `cancelAndHoldAtTime` computes the correct in-progress value
 * from the scheduled curve itself. */
export function scheduleAutomation(
  param: AudioParam,
  points: AutomationPoint[],
  audioContext: BaseAudioContext,
  durationSeconds: number,
  valueRange: AutomationValueRange = DEFAULT_VALUE_RANGE,
  atTime?: number,
): void {
  const startTime = atTime ?? audioContext.currentTime;
  param.cancelAndHoldAtTime(startTime);
  const { min, max } = valueRange;
  for (const point of points) {
    const mapped = min + point.value * (max - min);
    param.linearRampToValueAtTime(
      mapped,
      startTime + point.position * durationSeconds,
    );
  }
}

export interface AutomationLoopHandle {
  stop(): void;
}

/** Re-triggers scheduleAutomation every durationSeconds, re-reading
 * getPoints/getDurationSeconds on each cycle so a shape or duration change
 * takes effect starting next loop, without restarting. */
export function startAutomationLoop(
  param: AudioParam,
  audioContext: BaseAudioContext,
  getPoints: () => AutomationPoint[],
  getDurationSeconds: () => number,
  valueRange: AutomationValueRange = DEFAULT_VALUE_RANGE,
): AutomationLoopHandle {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function tick(): void {
    const durationSeconds = getDurationSeconds();
    scheduleAutomation(
      param,
      getPoints(),
      audioContext,
      durationSeconds,
      valueRange,
    );
    timeoutId = setTimeout(tick, durationSeconds * 1000);
  }
  tick();

  return {
    stop() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
