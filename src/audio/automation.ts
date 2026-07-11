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
 * 0..1 remapped into `valueRange`) as a ramp onto `param`, anchoring at the
 * param's current value first so this doesn't click if a previous
 * schedule's tail hasn't finished yet. One-shot — call again (or use
 * startAutomationLoop) to repeat it. */
export function scheduleAutomation(
  param: AudioParam,
  points: AutomationPoint[],
  audioContext: BaseAudioContext,
  durationSeconds: number,
  valueRange: AutomationValueRange = DEFAULT_VALUE_RANGE,
): void {
  const now = audioContext.currentTime;
  param.cancelScheduledValues(now);
  // Anchor at whatever the param actually is right now, not an assumed
  // start value — if a previous cycle's tail hasn't fully settled, or
  // scheduling just lands a few ms early, forcing a hard jump would cause
  // an audible click even though the curve's own shape is well-defined.
  param.setValueAtTime(param.value, now);
  const { min, max } = valueRange;
  for (const point of points) {
    const mapped = min + point.value * (max - min);
    param.linearRampToValueAtTime(
      mapped,
      now + point.position * durationSeconds,
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
