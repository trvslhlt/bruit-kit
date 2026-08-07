/** Pure timing/easing math for a "random-walk wander toward a moving
 * target" style of slow modulation -- distinct from a periodic LFO (see
 * bruit-kit's own audio/modulation/lfoEngine.ts for that): here the target
 * itself jumps to a fresh random point within a range every so often, and
 * the current value glides toward it, rather than tracing a fixed
 * waveform. No coupling to effects/params/audio nodes at all -- just two
 * `speed` (0..1) -> number mappings, reused by driftEngine.ts to wander an
 * effect param and by any future caller that wants the same "occasionally
 * retarget, always glide" pacing over some other numeric value. */

export const DRIFT_TICK_MS = 150;

/** How long to wait before picking a fresh wander target -- higher speed
 * retargets more often (shorter delay). Returns a randomized delay within
 * a speed-dependent span rather than a fixed interval, so multiple
 * drifting params don't all retarget in lockstep. */
export function retargetDelayMsFor(speed: number): number {
  const baseMs = 8000 - speed * 7000; // 8000ms (speed 0) .. 1000ms (speed 1)
  const spanMs = 5000 - speed * 4000; // 5000ms (speed 0) .. 1000ms (speed 1)
  return baseMs + Math.random() * spanMs;
}

/** How much of the remaining distance to the current wander target to
 * close per tick -- higher speed glides faster. */
export function lerpFactorFor(speed: number): number {
  return 0.01 + speed * 0.09; // 0.01 (speed 0) .. 0.10 (speed 1)
}
