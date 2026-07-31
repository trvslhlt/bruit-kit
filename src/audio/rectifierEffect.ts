import { type DryWetWrapper, createDryWet } from "./dryWet";

export type RectifierMode = "full" | "half";

export interface RectifierEffectParams {
  mode: RectifierMode;
  outputGain: number;
  wet: number;
}

/** Full-wave rectification (|x|) doubles the fundamental frequency (an
 * octave-up, buzzy character) at the cost of a strong DC bias; half-wave
 * (max(x, 0)) keeps only the positive half, a thinner and more overtly
 * "gated" texture. Both are exactly what a diode does to a signal in a
 * real rectifier/octave circuit -- this is deliberately not rescaled back
 * to a bipolar range the way HardClipEffect's curve is, since that DC-
 * heavy, always-non-negative shape is the actual rectified character, not
 * an artifact to hide. */
function makeRectifierCurve(mode: RectifierMode): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = mode === "full" ? Math.abs(x) : Math.max(x, 0);
  }
  return curve;
}

/** Diode-style rectification as an audible effect (rather than hidden
 * inside an envelope follower, as in AutoWahEffect) -- full-wave doubles
 * the fundamental for an octave-up buzz, half-wave keeps only the
 * positive half for a thinner, gated texture. */
export class RectifierEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. `mode` rebuilds the curve and isn't modulation-friendly
   * (nor would smoothly modulating a full/half switch make sense). */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeRectifierCurve("full");

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

  setParams(params: Partial<RectifierEffectParams>): void {
    if (params.mode !== undefined)
      this.shaper.curve = makeRectifierCurve(params.mode);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
