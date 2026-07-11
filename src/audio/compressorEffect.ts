import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface CompressorEffectParams {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  wet: number;
}

export class CompressorEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into them —
   * see FilterEffect.frequencyParam's doc comment for why this coexists
   * safely with setParams. */
  readonly thresholdParam: AudioParam;
  readonly ratioParam: AudioParam;
  readonly attackParam: AudioParam;
  readonly releaseParam: AudioParam;
  private compressorNode: DynamicsCompressorNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.compressorNode = audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;
    this.thresholdParam = this.compressorNode.threshold;
    this.ratioParam = this.compressorNode.ratio;
    this.attackParam = this.compressorNode.attack;
    this.releaseParam = this.compressorNode.release;

    this.dryWet = createDryWet(
      audioContext,
      this.compressorNode,
      this.compressorNode,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<CompressorEffectParams>): void {
    if (params.threshold !== undefined)
      this.compressorNode.threshold.value = params.threshold;
    if (params.ratio !== undefined)
      this.compressorNode.ratio.value = params.ratio;
    if (params.attack !== undefined)
      this.compressorNode.attack.value = params.attack;
    if (params.release !== undefined)
      this.compressorNode.release.value = params.release;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
