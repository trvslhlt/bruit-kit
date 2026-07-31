import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface WaveFolderEffectParams {
  fold: number;
  outputGain: number;
  wet: number;
}

/** Runs the signal through a sine rather than clipping it: sin(fold * x)
 * is a gentle near-identity curve at low fold, but once fold pushes
 * fold*x past ±π/2 the curve turns over and heads back toward 0 instead
 * of flattening out -- the input "folds" back on itself instead of being
 * clamped. That produces new harmonics that shift and multiply as the
 * input level rises, a genuinely different, more chaotic-sounding texture
 * than any clipping curve (which just gets flatter/buzzier at a fixed
 * rate), closer to a West Coast synth wavefolder. */
function makeWaveFolderCurve(fold: number): Float32Array<ArrayBuffer> {
  const k = Math.max(fold, 0.01);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.sin(k * x);
  }
  return curve;
}

/** Sine-based wavefolding: past a certain drive the signal reflects back
 * on itself instead of clipping flat, producing shifting, harmonically
 * dense textures that get more complex (not just louder/flatter) as
 * `fold` increases. */
export class WaveFolderEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. Only outputGain is modulation-friendly; `fold`
   * rebuilds a 1024-sample curve per change, too expensive to drive from
   * an LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeWaveFolderCurve(3);
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

  setParams(params: Partial<WaveFolderEffectParams>): void {
    if (params.fold !== undefined)
      this.shaper.curve = makeWaveFolderCurve(params.fold);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
