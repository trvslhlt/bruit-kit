import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface PanEffectParams {
  /** -1 (full left) .. 1 (full right), 0 is center. */
  pan: number;
  wet: number;
}

/** A single StereoPannerNode -- as simple as GainEffect, just spreading the
 * signal across the stereo field instead of scaling it. Still wrapped in
 * the standard dry/wet crossfade (see createDryWet) like every other
 * effect here, so "blend a pan to taste" works the same way it does for
 * everything else instead of needing a special case. */
export class PanEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect.frequencyParam's own doc comment. */
  readonly panParam: AudioParam;
  private pannerNode: StereoPannerNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.pannerNode = audioContext.createStereoPanner();
    this.pannerNode.pan.value = 0;
    this.panParam = this.pannerNode.pan;

    this.dryWet = createDryWet(
      audioContext,
      this.pannerNode,
      this.pannerNode,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<PanEffectParams>): void {
    if (params.pan !== undefined) {
      this.pannerNode.pan.value = Math.min(Math.max(params.pan, -1), 1);
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
