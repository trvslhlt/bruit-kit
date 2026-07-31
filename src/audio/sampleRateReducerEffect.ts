import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface SampleRateReducerEffectParams {
  /** How many real samples each output sample holds for, e.g. 4 = roughly
   * 1/4 the effective sample rate. 1 = no reduction at all. */
  holdSamples: number;
  outputGain: number;
  wet: number;
}

const DEFAULT_WORKLET_URL = "/worklets/sample-rate-reducer-processor.js";

/** Registers sample-rate-reducer-processor.js on `audioContext`. Must be
 * awaited once per AudioContext before constructing any
 * SampleRateReducerEffect against that context -- see
 * preloadPitchShiftWorklet's doc comment in pitchShiftEffect.ts for the
 * full reasoning (same constraint, same shape). */
export function preloadSampleRateReducerWorklet(
  audioContext: BaseAudioContext,
  workletUrl: string = DEFAULT_WORKLET_URL,
): Promise<void> {
  return audioContext.audioWorklet.addModule(workletUrl);
}

/** True sample-rate reduction (a zero-order hold) via an
 * AudioWorkletProcessor -- the aliased, gritty "lo-fi" half of a classic
 * bitcrusher that BitcrusherEffect's own doc comment says its
 * WaveShaperNode-curve technique can't reach, since holding a value across
 * several samples needs a per-sample loop, not an instantaneous amplitude
 * remap. Construction is synchronous like every other effect class here
 * (see PitchShiftEffect's doc comment) -- the caller must have already
 * awaited preloadSampleRateReducerWorklet(audioContext) for this exact
 * context, or the AudioWorkletNode construction below throws synchronously. */
export class SampleRateReducerEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. `holdSamples` goes through the worklet's message port
   * instead, not a modulation-friendly AudioParam. */
  readonly outputGainParam: AudioParam;
  private node: AudioWorkletNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.node = new AudioWorkletNode(
      audioContext,
      "sample-rate-reducer-processor",
      { outputChannelCount: [2] },
    );
    this.node.port.postMessage({ type: "setHold", holdSamples: 4 });

    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = 1;
    this.node.connect(this.outputGainNode);
    this.outputGainParam = this.outputGainNode.gain;

    this.dryWet = createDryWet(
      audioContext,
      this.node,
      this.outputGainNode,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<SampleRateReducerEffectParams>): void {
    if (params.holdSamples !== undefined) {
      this.node.port.postMessage({
        type: "setHold",
        holdSamples: params.holdSamples,
      });
    }
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
