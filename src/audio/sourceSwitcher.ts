import { weightedRandomIndex } from "./weightedRandom";

export interface WeightedSource {
  node: AudioNode;
  weight: number;
}

export interface SourceSwitcherParams {
  holdMinMs: number;
  holdMaxMs: number;
  transitionMs: number;
  /** Same order/length as the `sources` array passed to the constructor —
   * there's no id-based lookup, since sources are fixed at construction
   * time and never added or removed afterward. */
  weights: number[];
}

const CURVE_LENGTH = 128;

/** Equal-power (constant-power, not linear) fade shape: sin/cos of a
 * quarter turn, so an outgoing and incoming source's *power* sums to a
 * constant across the crossfade instead of dipping in the middle the way
 * DryWetWrapper's plain linear `1 - wet`/`wet` pair would for two
 * uncorrelated signals. Precomputed once at module load and reused for
 * every fade on every instance -- setValueCurveAtTime scales a fixed-shape
 * curve over whatever duration it's given, so there's no need to
 * regenerate this per transitionMs the way DistortionEffect's curve has
 * to regenerate per `amount`. */
function makeFadeCurve(direction: "in" | "out"): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_LENGTH * 4));
  for (let i = 0; i < CURVE_LENGTH; i++) {
    const phase = (Math.PI / 2) * (i / (CURVE_LENGTH - 1));
    curve[i] = direction === "in" ? Math.sin(phase) : Math.cos(phase);
  }
  return curve;
}

const FADE_IN_CURVE = makeFadeCurve("in");
const FADE_OUT_CURVE = makeFadeCurve("out");

/** Randomly picks one of several already-playing, already-connected
 * audio-rate sources to be audible at a time, re-rolling on a jittered
 * interval. Unlike every other file in this directory, this has no single
 * `input` — sources are wired in once at construction (each is expected
 * to already be producing continuous audio, e.g. a running OscillatorNode
 * or a NoiseGenerator in a held/sustained state) rather than chained
 * through it, since there's more than one of them and picking which one
 * plays is the entire point. Nothing here starts or stops a source's own
 * sound generation -- it only ever controls each one's audibility via a
 * dedicated gain node.
 *
 * Re-selection is an independent reroll each cycle (the current source
 * can legitimately win again if its weight is high), not forced
 * alternation. Crossfades use setValueCurveAtTime rather than
 * scheduleAutomation's ramp-to-value approach, since an equal-power curve
 * isn't expressible as a single linear ramp. */
export class SourceSwitcher {
  readonly output: GainNode;
  private sourceGains: GainNode[];
  private weights: number[];
  private holdMinMs: number;
  private holdMaxMs: number;
  private transitionMs: number;
  private currentIndex = -1;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private random: () => number;
  private switchCallback: ((index: number) => void) | null = null;

  constructor(
    private audioContext: AudioContext,
    sources: WeightedSource[],
    options: {
      holdMinMs?: number;
      holdMaxMs?: number;
      transitionMs?: number;
      random?: () => number;
    } = {},
  ) {
    this.output = audioContext.createGain();
    this.weights = sources.map((s) => s.weight);
    this.holdMinMs = options.holdMinMs ?? 1500;
    this.holdMaxMs = options.holdMaxMs ?? 4000;
    this.transitionMs = options.transitionMs ?? 400;
    this.random = options.random ?? Math.random;

    this.sourceGains = sources.map((source) => {
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      source.node.connect(gain);
      gain.connect(this.output);
      return gain;
    });

    this.tick();
  }

  setParams(params: Partial<SourceSwitcherParams>): void {
    if (params.holdMinMs !== undefined) this.holdMinMs = params.holdMinMs;
    if (params.holdMaxMs !== undefined) this.holdMaxMs = params.holdMaxMs;
    if (params.transitionMs !== undefined)
      this.transitionMs = params.transitionMs;
    if (params.weights !== undefined) this.weights = params.weights;
  }

  /** Fires with the newly-active source's index every time a switch lands,
   * plus once immediately with whatever's already active if a switch has
   * already happened by the time this is called -- the constructor makes
   * its first pick synchronously, before a caller has had any chance to
   * register a callback, so without this replay that first pick (and any
   * pick made before a late registration) would go unreported. */
  onSwitch(callback: (index: number) => void): void {
    this.switchCallback = callback;
    if (this.currentIndex !== -1) callback(this.currentIndex);
  }

  /** Stops future re-rolls. Whatever's currently audible stays audible at
   * its current gain -- this only clears the scheduling timer, it doesn't
   * fade anything to silence or disconnect any nodes. */
  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private tick(): void {
    const nextIndex = weightedRandomIndex(this.weights, this.random);
    this.switchTo(nextIndex);
    const holdMs =
      this.holdMinMs + this.random() * (this.holdMaxMs - this.holdMinMs);
    this.timeoutId = setTimeout(() => this.tick(), holdMs);
  }

  private switchTo(index: number): void {
    if (index === this.currentIndex) return;
    // transitionMs=0 would give setValueCurveAtTime a zero duration, which
    // throws -- floor it at a hair above zero instead of validating input.
    const transitionSeconds = Math.max(this.transitionMs / 1000, 0.001);
    const now = this.audioContext.currentTime;

    if (this.currentIndex !== -1) {
      this.scheduleFade(
        this.sourceGains[this.currentIndex].gain,
        FADE_OUT_CURVE,
        now,
        transitionSeconds,
      );
    }
    this.scheduleFade(
      this.sourceGains[index].gain,
      FADE_IN_CURVE,
      now,
      transitionSeconds,
    );

    this.currentIndex = index;
    this.switchCallback?.(index);
  }

  /** cancelAndHoldAtTime before the curve, same reasoning as
   * automation.ts's scheduleAutomation: without it, a switch landing
   * before the previous one's fade has finished would leave that stale
   * ramp still scheduled underneath the new one. This still jumps to the
   * curve's own first sample rather than blending from wherever the fade
   * was interrupted -- fine as long as transitionMs stays comfortably
   * under holdMinMs, which is the expected usage; it's not guarded against
   * a caller setting transitionMs larger than the hold range. */
  private scheduleFade(
    gainParam: AudioParam,
    curve: Float32Array<ArrayBuffer>,
    startTime: number,
    durationSeconds: number,
  ): void {
    gainParam.cancelAndHoldAtTime(startTime);
    gainParam.setValueCurveAtTime(curve, startTime, durationSeconds);
  }
}
