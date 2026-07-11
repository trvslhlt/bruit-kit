import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface DelayEffectParams {
  delayMs: number;
  feedback: number;
  wet: number;
}

const MAX_DELAY_SECONDS = 2.5;

export class DelayEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect's frequencyParam for why this coexists safely with
   * setParams. */
  readonly delayTimeParam: AudioParam;
  readonly feedbackParam: AudioParam;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.delayNode = audioContext.createDelay(MAX_DELAY_SECONDS);
    this.delayNode.delayTime.value = 0.3;

    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0.35;
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayTimeParam = this.delayNode.delayTime;
    this.feedbackParam = this.feedbackGain.gain;

    this.dryWet = createDryWet(audioContext, this.delayNode, this.delayNode, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<DelayEffectParams>): void {
    if (params.delayMs !== undefined) {
      this.delayNode.delayTime.value = Math.min(
        params.delayMs / 1000,
        MAX_DELAY_SECONDS,
      );
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
