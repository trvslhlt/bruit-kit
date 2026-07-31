import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface SoftClipEffectParams {
  drive: number;
  outputGain: number;
  wet: number;
}

/** tanh saturates to ±1 on its own, so there's no need to normalize by
 * tanh(drive) the way some soft-clip formulas do -- the curve already
 * passes through the origin with slope `drive` and flattens smoothly
 * toward ±1 as drive climbs, giving a warmer, rounder knee than
 * DistortionEffect's arctan curve or HardClipEffect's flat clamp. */
function makeSoftClipCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = Math.max(drive, 0.01);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
}

/** Tanh-curve saturation -- a smoother, warmer knee than DistortionEffect's
 * arctan curve, closer to how tape or a tube stage rounds off peaks rather
 * than the more aggressive breakup that curve is tuned for. */
export class SoftClipEffect {
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
    this.shaper.curve = makeSoftClipCurve(3);
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

  setParams(params: Partial<SoftClipEffectParams>): void {
    if (params.drive !== undefined)
      this.shaper.curve = makeSoftClipCurve(params.drive);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
