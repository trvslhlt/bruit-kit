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

/** Everything triggerRelease needs to work out where the attack/decay
 * curve actually is when release fires -- see triggerRelease's own
 * comment for why it has to compute this itself rather than asking the
 * AudioParam. Returned by triggerAttack; the caller holds onto it (e.g. on
 * its Voice object) until noteOff. */
export interface AttackSchedule {
  startTime: number;
  peak: number;
  adsr: AdsrParams;
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
): AttackSchedule {
  const attackSeconds = Math.max(adsr.attackMs, 0) / 1000;
  const decaySeconds = Math.max(adsr.decayMs, 0) / 1000;
  // cancelAndHoldAtTime is safe to use here (unlike in triggerRelease,
  // below) because this always runs on a brand new GainNode whose value
  // was just set synchronously to 0 -- there's no prior ramp history for
  // it to mis-track.
  gainParam.cancelAndHoldAtTime(atTime);
  gainParam.linearRampToValueAtTime(peak, atTime + attackSeconds);
  gainParam.linearRampToValueAtTime(
    peak * adsr.sustainLevel,
    atTime + attackSeconds + decaySeconds,
  );
  return { startTime: atTime, peak, adsr };
}

/** Ramps `gainParam` down to 0 over the release, anchored at wherever the
 * attack/decay curve from `attack` (triggerAttack's return value) actually
 * is at `atTime`. Returns the absolute AudioContext time the ramp
 * finishes, so the caller knows when it's safe to stop and disconnect the
 * underlying source node.
 *
 * The anchor value is computed here in plain arithmetic from `attack`'s
 * known parameters, rather than asked of the AudioParam itself, because
 * neither of the two obvious ways to ask it are reliable for every atTime
 * a caller in this repo actually uses (from "live, basically now" up to
 * midiPlayer.ts's 2-second lookahead):
 *  - A synchronous gainParam.value read reflects "right now", not what a
 *    scheduled curve will have reached by a *future* atTime -- reads the
 *    pre-attack baseline instead of the sustained peak, planting a click.
 *  - cancelAndHoldAtTime is supposed to solve exactly that by computing
 *    the curve's true value at a future time, and is what this function
 *    used to use -- but it returns a wrong, too-low value in Chrome once
 *    *two or more* chained ramp segments (the attack ramp, then the decay
 *    ramp) have already fully completed by its own query time, which is
 *    just the ordinary case of releasing a note sometime after it's
 *    settled into sustain. Confirmed with a minimal ConstantSourceNode +
 *    GainNode repro with no synth code involved at all, so it's a real
 *    engine bug, not a scheduling mistake here. Since this envelope is
 *    only ever two linear ramps, its value at any atTime is simple to
 *    compute directly, which sidesteps the browser's curve-tracking
 *    (and this bug) entirely instead of working around it. */
export function triggerRelease(
  gainParam: AudioParam,
  audioContext: BaseAudioContext,
  attack: AttackSchedule,
  atTime: number = audioContext.currentTime,
): number {
  const { startTime, peak, adsr } = attack;
  const attackSeconds = Math.max(adsr.attackMs, 0) / 1000;
  const decaySeconds = Math.max(adsr.decayMs, 0) / 1000;
  const attackEndTime = startTime + attackSeconds;
  const decayEndTime = attackEndTime + decaySeconds;
  const sustainValue = peak * adsr.sustainLevel;

  let anchorValue: number;
  if (atTime < startTime) {
    anchorValue = 0;
  } else if (atTime < attackEndTime) {
    anchorValue = peak * ((atTime - startTime) / attackSeconds);
  } else if (atTime < decayEndTime) {
    const decayProgress = (atTime - attackEndTime) / decaySeconds;
    anchorValue = peak + (sustainValue - peak) * decayProgress;
  } else {
    anchorValue = sustainValue;
  }

  gainParam.cancelScheduledValues(atTime);
  gainParam.setValueAtTime(anchorValue, atTime);
  const releaseSeconds = Math.max(adsr.releaseMs, 0) / 1000;
  const endTime = atTime + releaseSeconds;
  gainParam.linearRampToValueAtTime(0, endTime);
  return endTime;
}
