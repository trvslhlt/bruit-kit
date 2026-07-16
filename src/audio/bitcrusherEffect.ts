import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface BitcrusherEffectParams {
  bits: number;
  outputGain: number;
  wet: number;
}

/** Quantizes amplitude into 2^bits discrete steps via a WaveShaperNode
 * curve -- same curve-based technique as DistortionEffect, just a
 * stair-step shape instead of a soft-clip one. This only covers bit-depth
 * reduction, the "crunchy steps" half of a classic bitcrusher; the other
 * half (sample-rate reduction, the harsher aliased/"lo-fi" half) needs
 * per-sample hold logic that only an AudioWorkletProcessor provides, which
 * would make this effect's setup async unlike everything else in this
 * file -- out of scope here. */
function makeBitcrushCurve(bits: number): Float32Array<ArrayBuffer> {
  const clampedBits = Math.min(Math.max(Math.round(bits), 1), 16);
  const steps = 2 ** clampedBits;
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

export class BitcrusherEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. Only outputGain is modulation-friendly; `bits`
   * rebuilds a 1024-sample curve per change, too expensive to drive from
   * an LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeBitcrushCurve(6);

    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = 1;
    this.shaper.connect(this.outputGainNode);
    this.outputGainParam = this.outputGainNode.gain;

    this.dryWet = createDryWet(
      audioContext,
      this.shaper,
      this.outputGainNode,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<BitcrusherEffectParams>): void {
    if (params.bits !== undefined)
      this.shaper.curve = makeBitcrushCurve(params.bits);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
