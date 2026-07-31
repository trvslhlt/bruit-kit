import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface OverdriveEffectParams {
  drive: number;
  /** -1..1. 0 is a symmetric tanh curve (same shape as SoftClipEffect);
   * away from 0, the positive and negative halves saturate at different
   * rates, the way a real diode or tube stage clips asymmetrically. That
   * asymmetry adds even-order harmonics a symmetric curve can't produce,
   * which is most of what makes overdrive read as "warmer"/more musical
   * than a straight distortion. */
  asymmetry: number;
  outputGain: number;
  wet: number;
}

/** Curve depends on both drive and asymmetry jointly, so (unlike the
 * single-param curves in SoftClipEffect/HardClipEffect) this needs to
 * remember both between calls -- setParams may only touch one of them at
 * a time. */
interface CurveState {
  drive: number;
  asymmetry: number;
}

function makeOverdriveCurve(state: CurveState): Float32Array<ArrayBuffer> {
  const drive = Math.max(state.drive, 0.01);
  const asymmetry = Math.min(Math.max(state.asymmetry, -1), 1);
  // Scale each half's drive by up to ±90% rather than ±100% so neither
  // side's effective drive can hit zero (a dead flat half) or flip sign.
  const positiveDrive = drive * (1 + asymmetry * 0.9);
  const negativeDrive = drive * (1 - asymmetry * 0.9);
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = x >= 0 ? Math.tanh(positiveDrive * x) : Math.tanh(negativeDrive * x);
  }
  return curve;
}

/** Asymmetric tanh saturation -- SoftClipEffect with independently tunable
 * positive/negative drive, for the even-harmonic-rich "tube pushed into
 * breakup" character a symmetric curve can't reach. */
export class OverdriveEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. Only outputGain is modulation-friendly; drive/asymmetry
   * rebuild a 1024-sample curve per change, too expensive to drive from an
   * LFO. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;
  private curveState: CurveState = { drive: 5, asymmetry: 0.3 };

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeOverdriveCurve(this.curveState);
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

  setParams(params: Partial<OverdriveEffectParams>): void {
    if (params.drive !== undefined || params.asymmetry !== undefined) {
      this.curveState = { ...this.curveState, ...params };
      this.shaper.curve = makeOverdriveCurve(this.curveState);
    }
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
