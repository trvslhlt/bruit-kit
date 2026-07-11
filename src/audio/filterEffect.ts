import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface FilterEffectParams {
  type: BiquadFilterType;
  frequency: number;
  q: number;
  wet: number;
}

export class FilterEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * AudioParam signals are additive onto `.value`, so this coexists with
   * setParams' own `.value =` writes without conflict. */
  readonly frequencyParam: AudioParam;
  readonly qParam: AudioParam;
  private filterNode: BiquadFilterNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.filterNode = audioContext.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.value = 8000;
    this.filterNode.Q.value = 0.7;
    this.frequencyParam = this.filterNode.frequency;
    this.qParam = this.filterNode.Q;

    this.dryWet = createDryWet(
      audioContext,
      this.filterNode,
      this.filterNode,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<FilterEffectParams>): void {
    if (params.type !== undefined) this.filterNode.type = params.type;
    if (params.frequency !== undefined)
      this.filterNode.frequency.value = params.frequency;
    if (params.q !== undefined) this.filterNode.Q.value = params.q;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
