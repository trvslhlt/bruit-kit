/** Every effect type bruit-kit's audio module exports, and *all* of each
 * one's params -- not just a curated subset -- mirroring each effect
 * class's own full param list (see effectsChainBuilder.ts's
 * instantiateEffect). `wet` (dry/wet mix) is included for every type.
 * Pure data + pure range math, no DOM -- effectsFields.ts (the UI that
 * renders this as editable fields) and a caller's own live-nudge/drift
 * engine, if it has one, both build on this module without it knowing
 * about either. */

import type { EffectSpec, EffectType } from "../audio/effectSpec";

export interface EffectRangeParamSpec {
  key: string;
  label: string;
  kind: "range";
  min: number;
  max: number;
  step: number;
  default: number;
  /** `default`/the stored value are in the underlying effect class's own
   * native unit (e.g. compressor attack/release are seconds, the
   * DynamicsCompressorNode's own unit) -- `min`/`max`/`step` above are
   * already authored in whatever unit is actually UI-friendly (e.g.
   * milliseconds), so only the value itself needs converting: displayed
   * as `stored * scale`, written back as `display / scale`. Omitted (1)
   * for every param whose native unit is already UI-friendly. */
  scale?: number;
  /** Absolute ceiling a per-instance custom range (EffectSpec.paramRanges,
   * edited via this param's own clickable label -- see
   * openParamRangeModal) can never exceed -- only set here when a param
   * has a genuine constraint beyond "this was a comfortable slider
   * default" (see hardBoundFor's generic fallback for every param that
   * omits this). */
  hardMin?: number;
  hardMax?: number;
}

export interface EffectSelectParamSpec {
  key: string;
  label: string;
  kind: "select";
  options: string[];
  default: string;
}

export type EffectParamSpec = EffectRangeParamSpec | EffectSelectParamSpec;

/** Every persistent-chain effect type this UI exposes, and *all* of each
 * one's params -- not just the single headline param each used to get
 * (see effectsChain.ts's `instantiateEffect` and bruit-kit's individual
 * effect classes for the full param lists this mirrors). `wet` (dry/wet
 * mix) is included for every type: previously fixed at instantiation time
 * (1 for most, 0.35 for delay -- see the comment on delay's entry below)
 * and never user-adjustable at all. */
export const EFFECT_TABLE: Array<{
  type: EffectType;
  label: string;
  params: EffectParamSpec[];
}> = [
  {
    type: "filter",
    label: "Filter",
    params: [
      {
        key: "type",
        label: "Filter type",
        kind: "select",
        options: [
          "lowpass",
          "highpass",
          "bandpass",
          "lowshelf",
          "highshelf",
          "peaking",
          "notch",
          "allpass",
        ],
        default: "lowpass",
      },
      {
        key: "frequency",
        label: "Cutoff (Hz)",
        kind: "range",
        min: 200,
        max: 8000,
        step: 50,
        default: 8000,
      },
      {
        key: "q",
        label: "Resonance (Q)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 0.7,
      },
      // Only audible for lowshelf/highshelf/peaking -- BiquadFilterNode
      // ignores it for every other type -- but shown unconditionally like
      // every other param here (see effectsFields' own doc: nothing
      // conditionally shows/hides based on another field's value).
      {
        key: "gain",
        label: "Gain (dB, shelf/peaking only)",
        kind: "range",
        min: -40,
        max: 40,
        step: 1,
        default: 0,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "gain",
    label: "Gain",
    params: [
      {
        key: "gainDb",
        label: "Gain (dB)",
        kind: "range",
        min: -24,
        max: 24,
        step: 0.5,
        default: 0,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "distortion",
    label: "Distortion",
    params: [
      {
        key: "amount",
        label: "Amount",
        kind: "range",
        min: 0,
        max: 100,
        step: 1,
        default: 20,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "delay",
    label: "Delay",
    params: [
      {
        key: "delayMs",
        label: "Time (ms)",
        kind: "range",
        min: 10,
        max: 1000,
        step: 10,
        default: 180,
      },
      {
        key: "feedback",
        label: "Feedback",
        kind: "range",
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0.35,
      },
      // Not default 1 like the others -- see effectsChain.ts's
      // instantiateEffect for why full-wet is actually broken for delay
      // specifically (a short/percussive note can go fully silent until
      // an echo that may never arrive).
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.35,
      },
    ],
  },
  {
    type: "compressor",
    label: "Compressor",
    params: [
      {
        key: "threshold",
        label: "Threshold (dB)",
        kind: "range",
        min: -60,
        max: 0,
        step: 1,
        default: -24,
      },
      {
        key: "knee",
        label: "Knee (dB)",
        kind: "range",
        min: 0,
        max: 40,
        step: 1,
        default: 30,
      },
      {
        key: "ratio",
        label: "Ratio",
        kind: "range",
        min: 1,
        max: 20,
        step: 0.5,
        default: 12,
      },
      {
        key: "attack",
        label: "Attack (ms)",
        kind: "range",
        min: 0,
        max: 200,
        step: 1,
        default: 0.003,
        scale: 1000,
      },
      {
        key: "release",
        label: "Release (ms)",
        kind: "range",
        min: 0,
        max: 1000,
        step: 5,
        default: 0.25,
        scale: 1000,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "tremolo",
    label: "Tremolo",
    params: [
      {
        key: "rate",
        label: "Rate (Hz)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 5,
      },
      {
        key: "depth",
        label: "Depth",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "waveform",
        label: "LFO shape",
        kind: "select",
        options: ["sine", "square", "sawtooth", "triangle"],
        default: "sine",
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "ringMod",
    label: "Ring Mod",
    params: [
      {
        key: "frequency",
        label: "Frequency (Hz)",
        kind: "range",
        min: 1,
        max: 2000,
        step: 1,
        default: 30,
      },
      {
        key: "waveform",
        label: "Carrier shape",
        kind: "select",
        options: ["sine", "square", "sawtooth", "triangle"],
        default: "sine",
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "chorus",
    label: "Chorus",
    params: [
      {
        key: "rate",
        label: "Rate (Hz)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 0.8,
      },
      {
        key: "depth",
        label: "Depth (ms)",
        kind: "range",
        min: 0,
        max: 20,
        step: 0.5,
        default: 3,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "flanger",
    label: "Flanger",
    params: [
      {
        key: "rate",
        label: "Rate (Hz)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 0.25,
      },
      {
        key: "depth",
        label: "Depth (ms)",
        kind: "range",
        min: 0,
        max: 5,
        step: 0.1,
        default: 2,
      },
      {
        key: "feedback",
        label: "Feedback",
        kind: "range",
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "phaser",
    label: "Phaser",
    params: [
      {
        key: "rate",
        label: "Rate (Hz)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 0.3,
      },
      {
        key: "depth",
        label: "Depth",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "feedback",
        label: "Feedback",
        kind: "range",
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0.3,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "autoWah",
    label: "Auto-Wah",
    params: [
      {
        key: "baseFrequency",
        label: "Base frequency (Hz)",
        kind: "range",
        min: 100,
        max: 3000,
        step: 10,
        default: 500,
      },
      {
        key: "q",
        label: "Resonance (Q)",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 6,
      },
      {
        key: "sensitivity",
        label: "Sensitivity",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "attackHz",
        label: "Attack speed (Hz)",
        kind: "range",
        min: 1,
        max: 50,
        step: 1,
        default: 15,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "bitcrusher",
    label: "Bitcrusher",
    params: [
      {
        key: "bits",
        label: "Bit depth",
        kind: "range",
        min: 1,
        max: 16,
        step: 1,
        default: 6,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "reverb",
    label: "Reverb",
    params: [
      {
        key: "decaySeconds",
        label: "Decay (s)",
        kind: "range",
        min: 0.1,
        max: 8,
        step: 0.1,
        default: 2.2,
      },
      {
        key: "preDelayMs",
        label: "Pre-delay (ms)",
        kind: "range",
        min: 0,
        max: 200,
        step: 1,
        default: 20,
      },
      {
        key: "dampingHz",
        label: "Damping (Hz)",
        kind: "range",
        min: 500,
        max: 12000,
        step: 100,
        default: 6000,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "pitchShift",
    label: "Pitch shift",
    params: [
      {
        key: "octave",
        label: "Octave",
        kind: "range",
        min: -2,
        max: 2,
        step: 1,
        default: 0,
        hardMin: -4,
        hardMax: 4,
      },
      {
        key: "semitones",
        label: "Semitones",
        kind: "range",
        min: -12,
        max: 12,
        step: 1,
        default: 0,
        hardMin: -24,
        hardMax: 24,
      },
      {
        key: "cents",
        label: "Cents",
        kind: "range",
        min: -50,
        max: 50,
        step: 1,
        default: 0,
        // A full semitone is 100 cents -- beyond that, "fine tune" is just
        // a worse-labeled semitone shift, so this stays capped there even
        // as a custom range rather than sharing the generic 3x-widened
        // fallback every other param without an explicit hard bound gets.
        hardMin: -100,
        hardMax: 100,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "softClip",
    label: "Soft Clip",
    params: [
      {
        key: "drive",
        label: "Drive",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 3,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "hardClip",
    label: "Hard Clip",
    params: [
      {
        key: "threshold",
        label: "Threshold",
        kind: "range",
        min: 0.01,
        max: 1,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "overdrive",
    label: "Overdrive",
    params: [
      {
        key: "drive",
        label: "Drive",
        kind: "range",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 5,
      },
      {
        key: "asymmetry",
        label: "Asymmetry",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: 0.3,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "waveFolder",
    label: "Wave Folder",
    params: [
      {
        key: "fold",
        label: "Fold",
        kind: "range",
        min: 0.1,
        max: 15,
        step: 0.1,
        default: 3,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "fuzz",
    label: "Fuzz",
    params: [
      {
        key: "drive",
        label: "Drive",
        kind: "range",
        min: 0.1,
        max: 30,
        step: 0.1,
        default: 10,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "foldbackDistortion",
    label: "Foldback Distortion",
    params: [
      {
        key: "threshold",
        label: "Threshold",
        kind: "range",
        min: 0.02,
        max: 1,
        step: 0.01,
        default: 0.5,
        // Matches the effect's own internal clamp (see
        // foldbackDistortionEffect.ts's makeFoldbackCurve) -- below 0.02
        // the reflection math degenerates, not just "an extreme setting."
        hardMin: 0.02,
        hardMax: 1,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "rectifier",
    label: "Rectifier",
    params: [
      {
        key: "mode",
        label: "Mode",
        kind: "select",
        options: ["full", "half"],
        default: "full",
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "tapeSaturation",
    label: "Tape Saturation",
    params: [
      {
        key: "warmth",
        label: "Warmth",
        kind: "range",
        min: 0,
        max: 3,
        step: 0.05,
        default: 1,
      },
      {
        key: "tone",
        label: "Tone",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.7,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "sampleRateReducer",
    label: "Sample Rate Reducer",
    params: [
      {
        key: "holdSamples",
        label: "Hold (samples)",
        kind: "range",
        min: 1,
        max: 32,
        step: 1,
        default: 4,
        hardMin: 1,
        hardMax: 128,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
  {
    type: "parametricWaveshaper",
    label: "Parametric Waveshaper",
    params: [
      {
        key: "pointAtNegOne",
        label: "Point @ -1",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: -1,
      },
      {
        key: "pointAtNegHalf",
        label: "Point @ -0.5",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: -0.5,
      },
      {
        key: "pointAtZero",
        label: "Point @ 0",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: 0,
      },
      {
        key: "pointAtHalf",
        label: "Point @ 0.5",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: 0.5,
      },
      {
        key: "pointAtOne",
        label: "Point @ 1",
        kind: "range",
        min: -1,
        max: 1,
        step: 0.01,
        default: 1,
      },
      {
        key: "outputGain",
        label: "Output gain",
        kind: "range",
        min: 0,
        max: 2,
        step: 0.05,
        default: 1,
      },
      {
        key: "wet",
        label: "Wet",
        kind: "range",
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
      },
    ],
  },
];

/** The absolute min/max a per-instance custom range (EffectSpec.
 * paramRanges, see effectSpec.ts's own doc) can never exceed, regardless
 * of what a caller sets -- "there should still be limits." Two named
 * special cases with a genuine constraint behind them, then a
 * generic fallback for every other param, whose default min/max was
 * always just a comfortable slider range rather than a physical limit:
 * - `wet`: every effect's dry/wet crossfade is a 0..1 ratio by
 *   definition (see bruit-kit's createDryWet) -- never anything else.
 * - `feedback`: must stay under 1 or a delay/flanger/chorus's feedback
 *   loop runs away into unbounded self-oscillation instead of decaying.
 * - everything else: widened 3x outward from the table's own default
 *   span, floored at 0 for params whose default range never goes
 *   negative (Hz, ms, seconds, counts) -- generous enough to "flex
 *   beyond arbitrary hardcoded limits" without being unbounded.
 */
export function hardBoundFor(param: EffectRangeParamSpec): {
  min: number;
  max: number;
} {
  if (param.hardMin !== undefined && param.hardMax !== undefined) {
    return { min: param.hardMin, max: param.hardMax };
  }
  if (param.key === "wet") return { min: 0, max: 1 };
  if (param.key === "feedback") return { min: 0, max: 0.98 };
  const span = param.max - param.min;
  const hardMin = param.min - span;
  return {
    min: param.min >= 0 ? Math.max(0, hardMin) : hardMin,
    max: param.max + span,
  };
}

/** The range currently in effect for one param of one effect instance --
 * `spec.paramRanges[key]` if the user has customized it, otherwise the
 * table's own default `{min, max}`. */
export function activeRangeFor(
  spec: EffectSpec,
  param: EffectRangeParamSpec,
): { min: number; max: number } {
  return spec.paramRanges?.[param.key] ?? { min: param.min, max: param.max };
}
