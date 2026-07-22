import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface GainEffectParams {
  /** Boost/cut in dB, converted to a linear multiplier on the gain node
   * (10^(dB/20)) -- dB is the UI-friendly unit every caller authors this
   * in, same reasoning as compressor's threshold/knee already being dB. */
  gainDb: number;
  wet: number;
}

/** The simplest possible effect in this toolkit: a single GainNode. Still
 * wrapped in the standard dry/wet crossfade like every other effect here
 * (see createDryWet) rather than a bare multiply, so "blend a boost/cut to
 * taste" works the same way it does for every other effect type instead of
 * needing a special case. */
export class GainEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  private gainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 1;

    this.dryWet = createDryWet(audioContext, this.gainNode, this.gainNode, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<GainEffectParams>): void {
    if (params.gainDb !== undefined) {
      this.gainNode.gain.value = 10 ** (params.gainDb / 20);
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
