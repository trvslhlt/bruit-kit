import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface ParametricWaveshaperEffectParams {
  /** Output value (-1..1) the curve passes through at input -1. */
  pointAtNegOne: number;
  /** Output value (-1..1) the curve passes through at input -0.5. */
  pointAtNegHalf: number;
  /** Output value (-1..1) the curve passes through at input 0. */
  pointAtZero: number;
  /** Output value (-1..1) the curve passes through at input 0.5. */
  pointAtHalf: number;
  /** Output value (-1..1) the curve passes through at input 1. */
  pointAtOne: number;
  outputGain: number;
  wet: number;
}

/** All 5 curve points, kept together (unlike the other effects here, whose
 * curves depend on 1-2 params) since rebuilding the curve needs every
 * point's current value even when setParams only touches one of them. */
type CurvePoints = Pick<
  ParametricWaveshaperEffectParams,
  "pointAtNegOne" | "pointAtNegHalf" | "pointAtZero" | "pointAtHalf" | "pointAtOne"
>;

const DEFAULT_POINTS: CurvePoints = {
  pointAtNegOne: -1,
  pointAtNegHalf: -0.5,
  pointAtZero: 0,
  pointAtHalf: 0.5,
  pointAtOne: 1,
};

const CONTROL_XS = [-1, -0.5, 0, 0.5, 1];

/** Piecewise-linear interpolation through 5 user-set control points --
 * a "design your own transfer curve" effect via plain sliders, rather
 * than a fixed formula like every other effect here. The defaults trace
 * a straight line (an identity curve, i.e. no shaping at all) so moving
 * any one slider is what introduces distortion, starting from silence. */
function makeParametricCurve(points: CurvePoints): Float32Array<ArrayBuffer> {
  const ys = [
    points.pointAtNegOne,
    points.pointAtNegHalf,
    points.pointAtZero,
    points.pointAtHalf,
    points.pointAtOne,
  ];
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    let segment = CONTROL_XS.length - 2;
    for (let s = 0; s < CONTROL_XS.length - 1; s++) {
      if (x <= CONTROL_XS[s + 1]) {
        segment = s;
        break;
      }
    }
    const x0 = CONTROL_XS[segment];
    const x1 = CONTROL_XS[segment + 1];
    const y0 = ys[segment];
    const y1 = ys[segment + 1];
    const t = (x - x0) / (x1 - x0);
    curve[i] = y0 + (y1 - y0) * t;
  }
  return curve;
}

/** A user-defined transfer curve via 5 draggable-by-slider control points
 * (at input -1, -0.5, 0, 0.5, 1), rather than any single fixed formula --
 * covers shapes none of the other effects here can reach directly (an
 * offset/DC-biased curve, an inverted section, a deliberately lopsided
 * one) at the cost of a coarser (5-point, linearly-interpolated) curve
 * than their smooth analytic ones. */
export class ParametricWaveshaperEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see DistortionEffect's outputGainParam for why this coexists safely
   * with setParams. The control points rebuild a 1024-sample curve per
   * change, too expensive to drive from an LFO; only outputGain is
   * modulation-friendly. */
  readonly outputGainParam: AudioParam;
  private shaper: WaveShaperNode;
  private outputGainNode: GainNode;
  private dryWet: DryWetWrapper;
  private points: CurvePoints = { ...DEFAULT_POINTS };

  constructor(audioContext: AudioContext) {
    this.shaper = audioContext.createWaveShaper();
    this.shaper.curve = makeParametricCurve(this.points);
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

  setParams(params: Partial<ParametricWaveshaperEffectParams>): void {
    if (
      params.pointAtNegOne !== undefined ||
      params.pointAtNegHalf !== undefined ||
      params.pointAtZero !== undefined ||
      params.pointAtHalf !== undefined ||
      params.pointAtOne !== undefined
    ) {
      this.points = { ...this.points, ...params };
      this.shaper.curve = makeParametricCurve(this.points);
    }
    if (params.outputGain !== undefined)
      this.outputGainNode.gain.value = params.outputGain;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
