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

/** Discrete counterpart to scheduleAutomation's continuous ramp: looks up
 * `points`' value at a single `position` (0..1) via linear interpolation
 * between the two bracketing points, remapped into `valueRange` -- for a
 * caller that needs one number *now* (e.g. "how long is the gap before the
 * next repeat") rather than scheduling a ramp onto an AudioParam over time.
 * `position` outside 0..1 clamps to the first/last point. */
export function sampleCurveAt(
  points: AutomationPoint[],
  position: number,
  valueRange: AutomationValueRange = DEFAULT_VALUE_RANGE,
): number {
  if (points.length === 0) return valueRange.min;
  const clamped = Math.min(1, Math.max(0, position));
  let value = points[points.length - 1].value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (clamped >= a.position && clamped <= b.position) {
      const span = b.position - a.position;
      const t = span > 0 ? (clamped - a.position) / span : 0;
      value = a.value + t * (b.value - a.value);
      break;
    }
  }
  const { min, max } = valueRange;
  return min + value * (max - min);
}

/** Same lookup as sampleCurveAt, but takes elapsed wall-clock time and wraps
 * it into the curve's 0..1 domain first -- for a value that should keep
 * cycling through the curve for as long as something is running (e.g. a
 * node's live range position drifting through a source buffer), rather than
 * a one-shot lookup at a fixed position. `durationSeconds <= 0` is treated
 * as "always at the curve's start" instead of dividing by zero. */
export function curvePositionAtElapsed(
  points: AutomationPoint[],
  elapsedSeconds: number,
  durationSeconds: number,
  valueRange: AutomationValueRange = DEFAULT_VALUE_RANGE,
): number {
  if (durationSeconds <= 0) return sampleCurveAt(points, 0, valueRange);
  const wrapped =
    ((elapsedSeconds % durationSeconds) + durationSeconds) % durationSeconds;
  return sampleCurveAt(points, wrapped / durationSeconds, valueRange);
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
