import { type AutomationPoint, sampleCurveAt } from "../audio/automation";
import type { NoteTarget } from "../midi/noteTarget";

export interface PhaseDistortionParams {
  /** 0 = pure sine (the distortion table has no effect); 1 = fully warped
   * through the distortion curve set via setDistortionCurve. The classic
   * Casio CZ "DCW" sweep -- ramping this from 0 to 1 over a note's
   * envelope (or via an external automation sweep) is what gives PD its
   * signature filter-sweep-like brightening, without an actual filter. */
  distortionAmount: number;
  attackMs: number;
  decayMs: number;
  sustainLevel: number;
  releaseMs: number;
}

export interface PhaseDistortionSynthOptions {
  /** Where the AudioWorkletProcessor script is served from. Defaults to
   * where this library's own demo serves it; a consuming app that copies
   * phase-distortion-processor.js to a different public path should pass
   * that path here instead (same convention as GranularSynth/
   * DirectionalSamplePlayer's own workletUrl option). */
  workletUrl?: string;
}

const DEFAULT_WORKLET_URL = "/worklets/phase-distortion-processor.js";

// Table resolution for the distortion curve lookup -- see
// setDistortionCurve. 513 (2^9 + 1) gives smooth interpolation without
// being wastefully large for a curve that's usually just a handful of
// breakpoints.
const TABLE_SIZE = 513;

/** Casio CZ-style phase distortion: a linear phase ramp is warped through
 * a user-drawn curve *before* it's used to index a sine lookup, rather
 * than reshaping an existing signal's amplitude the way the waveshaping
 * effects (fuzzEffect.ts, waveFolderEffect.ts, parametricWaveshaperEffect.ts,
 * ...) do -- reading the same underlying sine at an uneven rate produces
 * extra harmonics, a cheap way to get filter-sweep-like, harmonically rich
 * tones from one oscillator and a curve. See
 * phase-distortion-processor.js's own module doc comment for the full
 * explanation.
 *
 * A worklet-based source (unlike FmSynth/OscillatorSynth's plain native
 * OscillatorNodes) since arbitrary per-sample phase warping isn't
 * expressible through any built-in Web Audio node -- FM synthesis gets
 * away with native nodes because "modulate the frequency AudioParam
 * continuously" already *is* a form of phase modulation, but a fixed,
 * user-drawn warp curve needs an actual per-sample table lookup.
 *
 * Polyphonic voices and their ADSR envelopes are entirely worklet-internal
 * (message-driven noteOn/noteOff), the same pattern GranularSynth and
 * DirectionalSamplePlayer already use for their own voice pools, rather
 * than one AudioWorkletNode per voice the way FmSynth uses one
 * OscillatorNode per voice. */
export class PhaseDistortionSynth implements NoteTarget {
  readonly output: GainNode;
  private node: AudioWorkletNode | null = null;
  private moduleLoaded = false;
  private workletUrl: string;

  constructor(
    private audioContext: AudioContext,
    options: PhaseDistortionSynthOptions = {},
  ) {
    this.output = audioContext.createGain();
    this.workletUrl = options.workletUrl ?? DEFAULT_WORKLET_URL;
  }

  /** Sets up the worklet node. Safe to call before a user gesture; only
   * `audioContext.resume()` needs to happen inside one. */
  async init(): Promise<void> {
    if (this.node) return;
    if (!this.moduleLoaded) {
      await this.audioContext.audioWorklet.addModule(this.workletUrl);
      this.moduleLoaded = true;
    }
    this.node = new AudioWorkletNode(
      this.audioContext,
      "phase-distortion-processor",
      { outputChannelCount: [2] },
    );
    this.node.connect(this.output);
  }

  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }

  setParams(params: Partial<PhaseDistortionParams>): void {
    this.node?.port.postMessage({ type: "setParams", params });
  }

  /** Builds a fixed-resolution lookup table from a breakpoint curve (the
   * same AutomationPoint[] shape used everywhere else in bruit-kit, e.g.
   * automationEditor.ts) via sampleCurveAt, and sends it to the worklet --
   * table[i] is the warped phase at linear phase i/(TABLE_SIZE - 1).
   * Curve values are expected in [0,1] (a phase, not an arbitrary
   * quantity) -- the default valueRange leaves them untouched; pass a
   * narrower range only if you deliberately want the curve's own output
   * rescaled into a phase sub-range. */
  setDistortionCurve(
    points: AutomationPoint[],
    valueRange: { min: number; max: number } = { min: 0, max: 1 },
  ): void {
    const table = new Float32Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) {
      table[i] = sampleCurveAt(points, i / (TABLE_SIZE - 1), valueRange);
    }
    this.node?.port.postMessage({ type: "setDistortionTable", table }, [
      table.buffer,
    ]);
  }

  noteOn(note: number, velocity: number, time?: number): void {
    this.node?.port.postMessage({ type: "noteOn", note, velocity, time });
  }

  noteOff(note: number, time?: number): void {
    this.node?.port.postMessage({ type: "noteOff", note, time });
  }

  /** Immediately silences every voice, no release fade. */
  panic(): void {
    this.node?.port.postMessage({ type: "panic" });
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }
}
