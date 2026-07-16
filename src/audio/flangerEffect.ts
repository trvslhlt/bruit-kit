import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface FlangerEffectParams {
  rate: number;
  depth: number;
  feedback: number;
  wet: number;
}

const CENTER_DELAY_SECONDS = 0.005;
const MAX_DELAY_SECONDS = 0.015;
const MAX_DEPTH_MS = 5;

/** Same delayTime-modulation wiring as DelayEffect + TremoloEffect's LFO,
 * just with a much shorter center delay and a feedback loop around the
 * delay line -- the short delay puts the wet/dry comb-filter notches at
 * audible, widely-spaced frequencies (the "jet swoosh"), and feedback
 * resharpens those notches on each pass. ChorusEffect is the same idea at
 * a longer delay with two voices and no feedback. */
export class FlangerEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into them —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly rateParam: AudioParam;
  readonly feedbackParam: AudioParam;
  private lfo: OscillatorNode;
  private depthGain: GainNode;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.lfo = audioContext.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.25;
    this.rateParam = this.lfo.frequency;

    this.depthGain = audioContext.createGain();
    this.depthGain.gain.value = 0.002;

    this.delayNode = audioContext.createDelay(MAX_DELAY_SECONDS);
    this.delayNode.delayTime.value = CENTER_DELAY_SECONDS;

    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0.5;
    this.feedbackParam = this.feedbackGain.gain;
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    this.lfo.connect(this.depthGain);
    this.depthGain.connect(this.delayNode.delayTime);
    this.lfo.start();

    this.dryWet = createDryWet(audioContext, this.delayNode, this.delayNode, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<FlangerEffectParams>): void {
    if (params.rate !== undefined) this.lfo.frequency.value = params.rate;
    if (params.depth !== undefined) {
      this.depthGain.gain.value =
        Math.min(Math.max(params.depth, 0), MAX_DEPTH_MS) / 1000;
    }
    if (params.feedback !== undefined) {
      this.feedbackGain.gain.value = Math.min(
        Math.max(params.feedback, 0),
        0.95,
      );
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
