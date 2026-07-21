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

/** Tracks a voice's gain envelope well enough to compute its true current
 * value at any later time without asking the AudioParam (see
 * triggerRelease's own comment for why that's unreliable). Holds the
 * original attack/decay parameters always, plus -- once release has
 * actually been triggered -- that release ramp's own anchor and timing.
 *
 * The `release` field matters because a voice can be released more than
 * once: noteOff firing twice for the same note (e.g. a stray duplicate
 * event), or noteOn stealing a voice via stopVoice that a *previous*
 * noteOff already put mid-release. Without remembering that a release is
 * already lowering the gain, a second triggerRelease/triggerStealFade call
 * would fall back to the attack/decay math alone -- which has no idea
 * release ever happened -- and anchor on a stale, too-high value, planting
 * exactly the kind of click this module exists to avoid.
 *
 * triggerAttack returns the initial (no release yet) state; triggerRelease
 * returns the updated state reflecting its own new release ramp. Callers
 * must re-store the returned schedule (e.g. back onto the voice) so the
 * next call sees it. */
export interface EnvelopeSchedule {
  attackStartTime: number;
  peak: number;
  adsr: AdsrParams;
  release?: {
    startTime: number;
    fromValue: number;
    releaseSeconds: number;
  };
}

function valueAt(schedule: EnvelopeSchedule, atTime: number): number {
  const { attackStartTime, peak, adsr, release } = schedule;

  if (release) {
    if (atTime <= release.startTime) return release.fromValue;
    if (release.releaseSeconds <= 0) return 0;
    const progress = Math.min(
      1,
      (atTime - release.startTime) / release.releaseSeconds,
    );
    return release.fromValue * (1 - progress);
  }

  const attackSeconds = Math.max(adsr.attackMs, 0) / 1000;
  const decaySeconds = Math.max(adsr.decayMs, 0) / 1000;
  const attackEndTime = attackStartTime + attackSeconds;
  const decayEndTime = attackEndTime + decaySeconds;
  const sustainValue = peak * adsr.sustainLevel;

  if (atTime < attackStartTime) return 0;
  if (atTime < attackEndTime) {
    return peak * ((atTime - attackStartTime) / attackSeconds);
  }
  if (atTime < decayEndTime) {
    const decayProgress = (atTime - attackEndTime) / decaySeconds;
    return peak + (sustainValue - peak) * decayProgress;
  }
  return sustainValue;
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
): EnvelopeSchedule {
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
  return { attackStartTime: atTime, peak, adsr };
}

/** Ramps `gainParam` down to 0 over the release, anchored at wherever
 * `schedule` (triggerAttack's, or a previous triggerRelease/
 * triggerStealFade's, return value) says the gain actually is at `atTime`.
 * Returns the absolute AudioContext time the ramp finishes (so the caller
 * knows when it's safe to stop and disconnect the underlying source node)
 * together with the updated schedule reflecting this new release -- the
 * caller must re-store it (e.g. back onto the voice), see EnvelopeSchedule.
 *
 * The anchor value is computed here in plain arithmetic rather than asked
 * of the AudioParam itself, because neither of the two obvious ways to ask
 * it are reliable for every atTime a caller in this repo actually uses
 * (from "live, basically now" up to midiPlayer.ts's 2-second lookahead):
 *  - A synchronous gainParam.value read reflects "right now", not what a
 *    scheduled curve will have reached by a *future* atTime -- reads the
 *    pre-attack baseline instead of the sustained peak, planting a click.
 *  - cancelAndHoldAtTime is supposed to solve exactly that by computing
 *    the curve's true value at a future time, and is what this function
 *    used to use -- but it returns a wrong value in Chrome once a prior
 *    ramp segment has already fully completed by its own query time,
 *    which is just the ordinary case of releasing a note sometime after
 *    it's settled into sustain. Confirmed with a minimal ConstantSourceNode
 *    + GainNode repro with no synth code involved at all, so it's a real
 *    engine bug, not a scheduling mistake here. Since this envelope is
 *    only ever linear ramps, its value at any atTime is simple to compute
 *    directly, which sidesteps the browser's curve-tracking (and this bug)
 *    entirely instead of working around it. */
export function triggerRelease(
  gainParam: AudioParam,
  audioContext: BaseAudioContext,
  schedule: EnvelopeSchedule,
  atTime: number = audioContext.currentTime,
): { endTime: number; schedule: EnvelopeSchedule } {
  const anchorValue = valueAt(schedule, atTime);

  gainParam.cancelScheduledValues(atTime);
  gainParam.setValueAtTime(anchorValue, atTime);
  const releaseSeconds = Math.max(schedule.adsr.releaseMs, 0) / 1000;
  const endTime = atTime + releaseSeconds;
  gainParam.linearRampToValueAtTime(0, endTime);

  return {
    endTime,
    schedule: {
      ...schedule,
      release: { startTime: atTime, fromValue: anchorValue, releaseSeconds },
    },
  };
}

/** A same-note retrigger (rapid repeated noteOn) steals the previous voice
 * by stopping it outright -- but that voice's gain is almost always still
 * well above 0 at that point (it's nowhere near its own user-configured
 * release), so a hard stop with no fade at all is an instant truncation,
 * audible as a click on every rapid repeat. This is a fixed, short
 * declick fade instead of the user's own releaseMs: long enough to avoid
 * a step, short enough not to meaningfully overlap the new voice starting
 * in its place. Reuses triggerRelease's anchor math (via the same
 * EnvelopeSchedule) rather than duplicating it, just with the release
 * length overridden -- and correctly accounts for the voice already being
 * mid-release itself (see EnvelopeSchedule's own comment on why that
 * matters), which is exactly the case a stolen voice is often in. */
const STEAL_FADE_MS = 5;

export function triggerStealFade(
  gainParam: AudioParam,
  audioContext: BaseAudioContext,
  schedule: EnvelopeSchedule,
  atTime: number = audioContext.currentTime,
): { endTime: number; schedule: EnvelopeSchedule } {
  return triggerRelease(
    gainParam,
    audioContext,
    { ...schedule, adsr: { ...schedule.adsr, releaseMs: STEAL_FADE_MS } },
    atTime,
  );
}
