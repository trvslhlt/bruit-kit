export interface LimiterEffectParams {
  ceiling: number;
  release: number;
}

/** A brickwall-ish safety net for the end of a chain, not a creative effect —
 * always fully engaged (no dry/wet) so a hot mix of summed voices or effects
 * can't hard-clip at the audio device. Place it last, right before
 * `audioContext.destination`. */
export class LimiterEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  private limiterNode: DynamicsCompressorNode;

  constructor(audioContext: AudioContext) {
    this.limiterNode = audioContext.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.003;
    this.limiterNode.release.value = 0.1;
    this.input = this.limiterNode;
    this.output = this.limiterNode;
  }

  setParams(params: Partial<LimiterEffectParams>): void {
    if (params.ceiling !== undefined)
      this.limiterNode.threshold.value = params.ceiling;
    if (params.release !== undefined)
      this.limiterNode.release.value = params.release;
  }
}
