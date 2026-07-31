import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface HardClipEffectParams {
  threshold: number;
  outputGain: number;
  wet: number;
}

/** Flat-out clamps at ±threshold, then rescales back up by 1/threshold so
 * a lower threshold clips harder without also just getting quieter -- a
 * genuinely different (and harsher/buzzier) character than any smooth
 * curve like SoftClipEffect's tanh or DistortionEffect's arctan, closer to
 * a digital clipping/square-wave breakup. */
function makeHardClipCurve(threshold: number): Float32Array<ArrayBuffer> {
  const t = Math.min(Math.max(threshold, 0.01), 1);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.min(Math.max(x, -t), t) / t;
  }
  return curve;
}

/** Straight amplitude clamping -- the harsh, flat-topped clipping character
 * a smooth waveshaper curve can't produce, at the cost of being a much
 * more aggressive (and more alias-prone) effect than the others here. */
export class HardClipEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. Only outputGain is modulation-friendly; `threshold`
   * rebuilds a 1024-sample curve per change, too expensive to drive from
   * an LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeHardClipCurve(0.5);
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

  setParams(params: Partial<HardClipEffectParams>): void {
    if (params.threshold !== undefined)
      this.shaper.curve = makeHardClipCurve(params.threshold);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
