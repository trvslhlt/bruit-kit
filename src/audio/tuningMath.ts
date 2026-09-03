/** Pure math for "how far off am I tuned from a station" -- distinct from
 * modulation/driftMath.ts (which paces a value wandering over time): here
 * the input is a fixed distance (dial frequency minus station frequency),
 * and every function is a plain number -> number mapping with no coupling
 * to AudioNodes, AudioParams, or any specific app's station model. A
 * caller reads these every frame/tick and writes the results onto whatever
 * real nodes it owns (a FilterEffect's frequencyParam, a plain
 * OscillatorNode's frequency, a GainNode's gain), the same division of
 * labor driftMath.ts already uses.
 *
 * `deltaF` and `bandwidth` share whatever unit the caller's dial uses
 * (e.g. MHz) -- nothing here assumes a particular scale, only that both
 * arguments use the same one. */

const MUFFLE_CUTOFF_MIN_HZ = 300;
const MUFFLE_CUTOFF_MAX_HZ = 3000;
const HETERODYNE_MAX_HZ = 3000;

/** How far outside `bandwidth`, as a multiple of it, the Gaussian curve
 * keeps computing a nonzero (if tiny) value before signalGain hard-clips
 * it to 0 -- controls how quickly signal falls off approaching the
 * bandwidth edge rather than the curve still trailing off gently right at
 * the cutoff. */
const GAUSSIAN_SHAPE = 0.5;

/** Signal quality at `deltaF` from a station's center, peaking at
 * `maxSignalQuality` when `deltaF` is 0 and hard-clipped to exactly 0
 * once `deltaF` reaches `bandwidth` (a station is either in range or it
 * isn't -- no infinite-tail audibility). Gaussian, not linear, so a
 * precisely-tuned station sounds noticeably clearer than one just barely
 * caught at the edge of the dial's bandwidth. */
export function signalGain(
  deltaF: number,
  bandwidth: number,
  maxSignalQuality: number,
): number {
  if (bandwidth <= 0 || Math.abs(deltaF) >= bandwidth) return 0;
  const normalized = deltaF / (bandwidth * GAUSSIAN_SHAPE);
  return maxSignalQuality * Math.exp(-0.5 * normalized * normalized);
}

/** Static bed loudness given the strongest signal currently tuned in --
 * full volume at signal 0 (dead air), silent once signal reaches 1. Plain
 * inverse, not its own curve -- static filling in exactly what signal
 * isn't is what makes the crossfade read as one continuous "channel"
 * rather than two independently-faded layers. */
export function staticGainFromSignal(signalGain: number): number {
  return 1 - Math.min(1, Math.max(0, signalGain));
}

/** Lowpass cutoff for the off-tune "muffle" filter: bright
 * (`MUFFLE_CUTOFF_MAX_HZ`) exactly on-center, narrowing toward
 * `MUFFLE_CUTOFF_MIN_HZ` as `deltaF` approaches (or passes) `bandwidth`.
 * Clamped rather than hard-cut at `bandwidth` like signalGain -- a
 * filter's cutoff has to land somewhere even once a station is
 * inaudible, and continuing to narrow slightly past the edge avoids an
 * arbitrary discontinuity right where the caller likely also has
 * `signalGain` racing to 0 anyway. */
export function muffleCutoffHz(deltaF: number, bandwidth: number): number {
  if (bandwidth <= 0) return MUFFLE_CUTOFF_MIN_HZ;
  const closeness = 1 - Math.min(1, Math.abs(deltaF) / bandwidth);
  return (
    MUFFLE_CUTOFF_MIN_HZ +
    closeness * (MUFFLE_CUTOFF_MAX_HZ - MUFFLE_CUTOFF_MIN_HZ)
  );
}

/** Heterodyne whistle carrier frequency: swept down from
 * `HETERODYNE_MAX_HZ` toward 0Hz as `deltaF` shrinks toward the station's
 * exact center, emulating the beat note between two nearly-matched
 * carriers converging to silence at a perfect zero-beat. Frequency only --
 * whether the whistle is actually audible at a given moment is a separate
 * decision (scale a gain by `signalGain`/proximity), deliberately not
 * this function's job, so a caller can shape "audible only very close in"
 * independently of the sweep's own shape. */
export function heterodyneFrequencyHz(
  deltaF: number,
  bandwidth: number,
): number {
  if (bandwidth <= 0) return 0;
  const normalized = Math.min(1, Math.abs(deltaF) / bandwidth);
  return HETERODYNE_MAX_HZ * normalized;
}

// `distance` (0..1: 0 strong/easy, 1 weak/fussy) is a single authored
// "how good is this station" knob a station config can expose instead of
// hand-tuning bandwidth/maxSignalQuality separately -- these three map
// it onto the actual quantities the rest of this module works in.
// centerDriftRangeFromDistance returns a +/- range for a caller's own
// wander-toward-a-random-target pacing (e.g. driftMath.ts's
// retargetDelayMsFor/lerpFactorFor) to wander a station's *true* center
// within, over time -- this module only computes the range, the same
// division of labor as heterodyneFrequencyHz leaving "is it audible
// right now" to the caller.

const MIN_BANDWIDTH = 0.15;
const MAX_BANDWIDTH = 0.5;
const MIN_SIGNAL_QUALITY = 0.3;
const MAX_CENTER_DRIFT_RANGE = 0.1;

/** Capture window: wide (forgiving) at distance 0, narrowing toward
 * `MIN_BANDWIDTH` (fussy, precise tuning required) at distance 1. */
export function bandwidthFromDistance(distance: number): number {
  const clamped = Math.min(1, Math.max(0, distance));
  return MAX_BANDWIDTH - clamped * (MAX_BANDWIDTH - MIN_BANDWIDTH);
}

/** Peak reachable signal: 1 (full) at distance 0, down to
 * `MIN_SIGNAL_QUALITY` (still nominally receivable, never silent) at
 * distance 1. */
export function maxSignalQualityFromDistance(distance: number): number {
  const clamped = Math.min(1, Math.max(0, distance));
  return 1 - clamped * (1 - MIN_SIGNAL_QUALITY);
}

/** How far a station's true center can wander from its nominal dial
 * position: 0 at distance 0 (rock-solid), up to `MAX_CENTER_DRIFT_RANGE`
 * at distance 1 -- comparable to a distance-1 station's own (narrow)
 * bandwidth, so a poor-quality station can occasionally drift far enough
 * to be briefly untunable, not just harder to hear clearly. */
export function centerDriftRangeFromDistance(distance: number): number {
  return Math.min(1, Math.max(0, distance)) * MAX_CENTER_DRIFT_RANGE;
}
