import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface DistortionEffectParams {
  amount: number;
  outputGain: number;
  wet: number;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = Math.max(amount, 0);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class DistortionEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect's frequencyParam for why this coexists safely with
   * setParams. Only outputGain is modulation-friendly; `amount` rebuilds a
   * 1024-sample curve per change, too expensive to drive from an LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeDistortionCurve(20);
    this.shaper.oversample = "4x";

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

  setParams(params: Partial<DistortionEffectParams>): void {
    if (params.amount !== undefined)
      this.shaper.curve = makeDistortionCurve(params.amount);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
