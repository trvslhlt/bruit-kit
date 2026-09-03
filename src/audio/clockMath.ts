/** Pure math for syncing playback to a shared external clock, rather than
 * each listener starting a track from 0 whenever they happen to tune in --
 * the same wrap-into-range technique as automation.ts's
 * curvePositionAtElapsed, generalized to plain seconds instead of a 0..1
 * curve position. No coupling to AudioNodes/elements here; see
 * sources/clockedMediaPlayer.ts for the class that actually seeks a
 * <audio> element using this. */

/** Where a looping track "currently is," in seconds from its own start,
 * given how much time has passed on some shared clock since `epochSeconds`
 * -- e.g. `masterClockSeconds` from `Date.now() / 1000` (so a track stays
 * in sync with real elapsed time across page reloads/sessions, the way a
 * real broadcast keeps playing whether or not anyone's tuned in) and
 * `epochSeconds` fixed per track. `durationSeconds <= 0` returns 0 rather
 * than dividing by zero. */
export function loopedElapsed(
  masterClockSeconds: number,
  epochSeconds: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0;
  const elapsed = masterClockSeconds - epochSeconds;
  return ((elapsed % durationSeconds) + durationSeconds) % durationSeconds;
}
