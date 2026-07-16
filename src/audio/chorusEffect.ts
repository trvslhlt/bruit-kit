import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface ChorusEffectParams {
  rate: number;
  depth: number;
  wet: number;
}

const CENTER_DELAY_SECONDS = 0.02;
const MAX_DELAY_SECONDS = 0.05;
const MAX_DEPTH_MS = 20;

/** Two voices sharing one LFO, the second phase-inverted via a -1 gain, so
 * they sweep in opposite directions around the same center delay -- a
 * classic two-voice-widen trick, cheaper than running two independent
 * oscillators. FlangerEffect is the same delayTime-modulation idea with a
 * shorter delay, a feedback loop, and a single voice -- what makes this
 * read as "chorus" rather than "flange" is the longer center delay and no
 * feedback. */
export class ChorusEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly rateParam: AudioParam;
  private lfo: OscillatorNode;
  private depthGainA: GainNode;
  private depthGainB: GainNode;
  private inverter: GainNode;
  private delayA: DelayNode;
  private delayB: DelayNode;
  private wetInput: GainNode;
  private mix: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.lfo = audioContext.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.8;
    this.rateParam = this.lfo.frequency;

    this.depthGainA = audioContext.createGain();
    this.depthGainA.gain.value = 0.003;
    this.depthGainB = audioContext.createGain();
    this.depthGainB.gain.value = 0.003;
    this.inverter = audioContext.createGain();
    this.inverter.gain.value = -1;

    this.delayA = audioContext.createDelay(MAX_DELAY_SECONDS);
    this.delayA.delayTime.value = CENTER_DELAY_SECONDS;
    this.delayB = audioContext.createDelay(MAX_DELAY_SECONDS);
    this.delayB.delayTime.value = CENTER_DELAY_SECONDS;

    this.lfo.connect(this.depthGainA);
    this.depthGainA.connect(this.delayA.delayTime);
    this.lfo.connect(this.inverter);
    this.inverter.connect(this.depthGainB);
    this.depthGainB.connect(this.delayB.delayTime);
    this.lfo.start();

    this.wetInput = audioContext.createGain();
    this.wetInput.connect(this.delayA);
    this.wetInput.connect(this.delayB);

    this.mix = audioContext.createGain();
    this.mix.gain.value = 0.5;
    this.delayA.connect(this.mix);
    this.delayB.connect(this.mix);

    this.dryWet = createDryWet(audioContext, this.wetInput, this.mix, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<ChorusEffectParams>): void {
    if (params.rate !== undefined) this.lfo.frequency.value = params.rate;
    if (params.depth !== undefined) {
      const depthSeconds =
        Math.min(Math.max(params.depth, 0), MAX_DEPTH_MS) / 1000;
      this.depthGainA.gain.value = depthSeconds;
      this.depthGainB.gain.value = depthSeconds;
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
