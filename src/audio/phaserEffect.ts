import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface PhaserEffectParams {
  rate: number;
  depth: number;
  feedback: number;
  wet: number;
}

const STAGE_COUNT = 4;
const CENTER_FREQUENCY_HZ = 800;
const MAX_SWEEP_HZ = 800;

/** A cascade of allpass filter stages, each phase-shifting more at high
 * frequencies than low, with an LFO sweeping every stage's frequency in
 * unison. Summing that sweep back with the dry signal (in createDryWet)
 * is what turns the phase shift into moving notches -- unlike PhaserEffect's
 * FilterEffect cousin, no single BiquadFilterNode is being swept; it's the
 * *interaction* between stages and the dry path that creates the effect. */
export class PhaserEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into them —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly rateParam: AudioParam;
  readonly feedbackParam: AudioParam;
  private lfo: OscillatorNode;
  private depthGain: GainNode;
  private stages: BiquadFilterNode[];
  private feedbackGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.lfo = audioContext.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.3;
    this.rateParam = this.lfo.frequency;

    this.depthGain = audioContext.createGain();
    this.depthGain.gain.value = MAX_SWEEP_HZ * 0.5;

    this.stages = [];
    for (let i = 0; i < STAGE_COUNT; i++) {
      const stage = audioContext.createBiquadFilter();
      stage.type = "allpass";
      stage.frequency.value = CENTER_FREQUENCY_HZ;
      stage.Q.value = 1;
      this.depthGain.connect(stage.frequency);
      this.stages.push(stage);
    }
    for (let i = 0; i < this.stages.length - 1; i++) {
      this.stages[i].connect(this.stages[i + 1]);
    }
    this.lfo.connect(this.depthGain);
    this.lfo.start();

    const lastStage = this.stages[this.stages.length - 1];
    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0.3;
    this.feedbackParam = this.feedbackGain.gain;
    lastStage.connect(this.feedbackGain);
    this.feedbackGain.connect(this.stages[0]);

    this.dryWet = createDryWet(audioContext, this.stages[0], lastStage, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<PhaserEffectParams>): void {
    if (params.rate !== undefined) this.lfo.frequency.value = params.rate;
    if (params.depth !== undefined) {
      const clamped = Math.min(Math.max(params.depth, 0), 1);
      this.depthGain.gain.value = clamped * MAX_SWEEP_HZ;
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
