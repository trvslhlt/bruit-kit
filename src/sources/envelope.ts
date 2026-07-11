/** Shared ADSR gain-scheduling for the polyphonic sources in this directory
 * (oscillator/sample/noise/FM). Extracted for the same reason dryWet.ts
 * extracts the crossfade plumbing shared by the effects: the scheduling
 * math (anchoring, cancelling, ramp shape) is easy to get subtly wrong and
 * every source needs the exact same shape. Voice storage and stealing
 * policy stay local to each source, since the voice itself differs. */

export interface AdsrParams {
  attackMs: number;
  decayMs: number;
  sustainLevel: number;
  releaseMs: number;
}

/** Ramps `gainParam` from its current value up to `peak` over the attack,
 * then down to `peak * sustainLevel` over the decay, starting at `atTime`
 * (defaults to "now") rather than always the moment this is called — a
 * NoteTarget's noteOn can be given a future time (e.g. midiPlayer.ts
 * scheduling a whole file's worth of events ahead of time), and the
 * envelope has to start there too, not at call-time, or it'll have already
 * run its course by the time the voice actually starts sounding. */
export function triggerAttack(
  gainParam: AudioParam,
  audioContext: BaseAudioContext,
  adsr: AdsrParams,
  peak = 1,
  atTime: number = audioContext.currentTime,
): void {
  const attackSeconds = Math.max(adsr.attackMs, 0) / 1000;
  const decaySeconds = Math.max(adsr.decayMs, 0) / 1000;
  gainParam.cancelScheduledValues(atTime);
  gainParam.setValueAtTime(gainParam.value, atTime);
  gainParam.linearRampToValueAtTime(peak, atTime + attackSeconds);
  gainParam.linearRampToValueAtTime(
    peak * adsr.sustainLevel,
    atTime + attackSeconds + decaySeconds,
  );
}

/** Ramps `gainParam` from its current value down to 0 over the release,
 * starting at `atTime` (defaults to "now"). Returns the absolute
 * AudioContext time the ramp finishes, so the caller knows when it's safe
 * to stop and disconnect the underlying source node. */
export function triggerRelease(
  gainParam: AudioParam,
  audioContext: BaseAudioContext,
  adsr: AdsrParams,
  atTime: number = audioContext.currentTime,
): number {
  const releaseSeconds = Math.max(adsr.releaseMs, 0) / 1000;
  gainParam.cancelScheduledValues(atTime);
  gainParam.setValueAtTime(gainParam.value, atTime);
  const endTime = atTime + releaseSeconds;
  gainParam.linearRampToValueAtTime(0, endTime);
  return endTime;
}
