import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface CombFilterEffectParams {
  frequency: number;
  feedback: number;
  wet: number;
}

const MIN_FREQUENCY_HZ = 20;
const MAX_DELAY_SECONDS = 1 / MIN_FREQUENCY_HZ;

/** A feedback comb filter: a short, audible-pitch-range delay line feeding
 * back into itself, reinforcing whichever frequency's period matches the
 * delay time -- and that frequency's harmonics -- into a series of evenly
 * spaced resonant peaks. `frequency` is expressed directly in Hz (the
 * comb's fundamental), converted internally via delayTime = 1/frequency,
 * rather than raw delay time the way DelayEffect exposes it -- DelayEffect
 * targets echo-range delays (tens to thousands of ms) where the musical
 * unit is time; this targets audible-pitch-range delays (0.2-50ms) where
 * the musical unit is a frequency you're tuning the resonance to.
 *
 * `feedback` is bipolar (unlike DelayEffect/FlangerEffect's own 0..0.95):
 * positive reinforces every harmonic of `frequency` into peaks; negative
 * (phase-inverted) instead reinforces the *odd* harmonics of half that
 * frequency, shifting the peak/notch spacing -- a real, audible
 * difference in timbre, not just a sign flip on the same result, and the
 * whole reason a dedicated comb filter is worth having alongside
 * FlangerEffect (the same wiring with an LFO sweeping this same delay
 * time instead of it sitting fixed). */
export class CombFilterEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect.frequencyParam's own doc comment. Still in seconds
   * (the delay line's own native unit), not Hz -- a caller automating
   * pitch directly should convert 1/frequency itself. */
  readonly delayTimeParam: AudioParam;
  readonly feedbackParam: AudioParam;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.delayNode = audioContext.createDelay(MAX_DELAY_SECONDS);
    this.delayNode.delayTime.value = 1 / 440;

    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0.7;
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayTimeParam = this.delayNode.delayTime;
    this.feedbackParam = this.feedbackGain.gain;

    this.dryWet = createDryWet(audioContext, this.delayNode, this.delayNode, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<CombFilterEffectParams>): void {
    if (params.frequency !== undefined) {
      const clamped = Math.max(params.frequency, MIN_FREQUENCY_HZ);
      this.delayNode.delayTime.value = 1 / clamped;
    }
    if (params.feedback !== undefined) {
      this.feedbackGain.gain.value = Math.min(
        Math.max(params.feedback, -0.95),
        0.95,
      );
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
