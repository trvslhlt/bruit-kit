import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface FuzzEffectParams {
  drive: number;
  outputGain: number;
  wet: number;
}

/** An exponential-saturation curve rather than tanh: sign(x) * (1 -
 * e^-(drive*|x|)) reaches ±1 much faster than tanh does for the same
 * drive value, producing a sharper "knee" and a more compressed, buzzier
 * breakup at moderate drive -- the fizzier, more compressed character
 * fuzz pedals are known for, versus SoftClipEffect/OverdriveEffect's
 * rounder tanh curve. */
function makeFuzzCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = Math.max(drive, 0.01);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.sign(x) * (1 - Math.exp(-k * Math.abs(x)));
  }
  return curve;
}

/** Exponential-saturation fuzz: reaches full clipping much faster than a
 * tanh curve at the same drive, for the fizzy, compressed, near-square-wave
 * character of a fuzz pedal rather than a smoother overdrive breakup. */
export class FuzzEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. Only outputGain is modulation-friendly; `drive`
   * rebuilds a 1024-sample curve per change, too expensive to drive from
   * an LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeFuzzCurve(10);
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

  setParams(params: Partial<FuzzEffectParams>): void {
    if (params.drive !== undefined)
      this.shaper.curve = makeFuzzCurve(params.drive);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
