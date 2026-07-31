import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface TapeSaturationEffectParams {
  /** Unlike the other curve-based effects here, this is meant to be
   * driven gently (roughly 0..3) -- tape saturation is a subtle "glue"
   * effect, not an obvious distortion, so its useful range and intent
   * are genuinely different from turning SoftClipEffect's drive down low. */
  warmth: number;
  /** 0..1, mapped to a lowpass cutoff -- tape's natural high-frequency
   * loss, the other half of what makes this read as "tape" rather than
   * just a gentle clip. */
  tone: number;
  outputGain: number;
  wet: number;
}

const MIN_TONE_HZ = 1500;
const MAX_TONE_HZ = 10000;

/** Cubic soft-clip (1.5x - 0.5x^3, clamped) -- a gentler, more gradual
 * knee than tanh at low drive, the classic "tape/analog" saturation
 * formula. Combined with the lowpass stage after it (see the class
 * comment), not just a quieter SoftClipEffect. */
function makeTapeSaturationCurve(warmth: number): Float32Array<ArrayBuffer> {
  const k = Math.max(warmth, 0);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    const s = k * x;
    curve[i] = Math.min(Math.max(1.5 * s - 0.5 * s * s * s, -1), 1);
  }
  return curve;
}

/** Gentle cubic saturation followed by a lowpass "tone" stage -- this two-
 * node chain (not just a low-drive curve on its own) is what gives it a
 * genuinely different, warmer/duller character from SoftClipEffect rather
 * than being that effect's drive knob turned down. */
export class TapeSaturationEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. `warmth` rebuilds a 1024-sample curve per change, and
   * `tone` isn't exposed as a raw AudioParam since it's remapped through
   * MIN_TONE_HZ..MAX_TONE_HZ rather than being a direct frequency value —
   * only outputGain is modulation-friendly here. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private toneFilter: BiquadFilterNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeTapeSaturationCurve(1);

    this.toneFilter = audioContext.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.7;
    this.toneFilter.frequency.value = MIN_TONE_HZ + 0.7 * (MAX_TONE_HZ - MIN_TONE_HZ);
    this.shaper.connect(this.toneFilter);

    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = 1;
    this.toneFilter.connect(this.outputGainNode);
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

  setParams(params: Partial<TapeSaturationEffectParams>): void {
    if (params.warmth !== undefined)
      this.shaper.curve = makeTapeSaturationCurve(params.warmth);
    if (params.tone !== undefined) {
      const clamped = Math.min(Math.max(params.tone, 0), 1);
      this.toneFilter.frequency.value =
        MIN_TONE_HZ + clamped * (MAX_TONE_HZ - MIN_TONE_HZ);
    }
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
