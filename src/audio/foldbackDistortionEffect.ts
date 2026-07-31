import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface FoldbackDistortionEffectParams {
  threshold: number;
  outputGain: number;
  wet: number;
}

/** ((a % n) + n) % n -- JS's own `%` can return a negative result for a
 * negative `a` (it's a remainder operator, not a true modulo), which the
 * repeated-reflection math below depends on being non-negative. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** The standard "foldback" algorithm: past ±threshold, the signal
 * repeatedly reflects off both the threshold and its negative rather than
 * clamping flat (HardClipEffect) or being (comparatively gently) folded
 * once by a sine (WaveFolderEffect) -- a lower threshold means more
 * reflections packed into the same ±1 range, producing an increasingly
 * dense, glitchy, metallic texture rather than just a harder-clipped one. */
function makeFoldbackCurve(threshold: number): Float32Array<ArrayBuffer> {
  const t = Math.min(Math.max(threshold, 0.02), 1);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    let x = (i * 2) / n - 1;
    if (x > t || x < -t) {
      x = Math.abs(Math.abs(mod(x - t, t * 4)) - t * 2) - t;
    }
    curve[i] = x;
  }
  return curve;
}

/** Foldback distortion: the signal reflects repeatedly off ±threshold
 * instead of clamping, giving a denser, glitchier, more metallic texture
 * than a simple clip or a single sine fold, and one that changes character
 * (not just gets louder/harder) as the input level rises past threshold. */
export class FoldbackDistortionEffect {
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
    this.shaper.curve = makeFoldbackCurve(0.5);
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

  setParams(params: Partial<FoldbackDistortionEffectParams>): void {
    if (params.threshold !== undefined)
      this.shaper.curve = makeFoldbackCurve(params.threshold);
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
