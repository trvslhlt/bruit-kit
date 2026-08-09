// A static registry of which AudioParam property each EffectType exposes
// (see each effect class's own `readonly xParam: AudioParam` fields) and a
// friendly label for it -- for a consumer building a "pick a param to
// modulate" UI (e.g. relpmas's sweep/LFO routes) to populate a dropdown
// instead of asking the user to type a property name like "frequencyParam"
// from memory. Kept here (not per-app) since it's a plain fact about
// bruit-kit's own effect classes, not anything app-specific.

import type { EffectType } from "./effectSpec";

export interface EffectParamOption {
  /** Matches BuiltEffectsChain.getAudioParam's own `key` argument -- the
   * effect instance's property name for this AudioParam. */
  key: string;
  label: string;
}

const EFFECT_PARAM_OPTIONS: Record<EffectType, EffectParamOption[]> = {
  filter: [
    { key: "frequencyParam", label: "Frequency (Hz)" },
    { key: "qParam", label: "Q" },
    { key: "gainParam", label: "Gain (dB)" },
  ],
  gain: [],
  delay: [
    { key: "delayTimeParam", label: "Delay time (s)" },
    { key: "feedbackParam", label: "Feedback" },
  ],
  distortion: [{ key: "outputGainParam", label: "Output gain" }],
  compressor: [
    { key: "thresholdParam", label: "Threshold (dB)" },
    { key: "kneeParam", label: "Knee (dB)" },
    { key: "ratioParam", label: "Ratio" },
    { key: "attackParam", label: "Attack (s)" },
    { key: "releaseParam", label: "Release (s)" },
  ],
  tremolo: [
    { key: "rateParam", label: "Rate (Hz)" },
    { key: "depthParam", label: "Depth" },
  ],
  ringMod: [{ key: "frequencyParam", label: "Frequency (Hz)" }],
  chorus: [{ key: "rateParam", label: "Rate (Hz)" }],
  flanger: [
    { key: "rateParam", label: "Rate (Hz)" },
    { key: "feedbackParam", label: "Feedback" },
  ],
  phaser: [
    { key: "rateParam", label: "Rate (Hz)" },
    { key: "feedbackParam", label: "Feedback" },
  ],
  autoWah: [{ key: "qParam", label: "Q" }],
  bitcrusher: [{ key: "outputGainParam", label: "Output gain" }],
  reverb: [
    { key: "preDelayParam", label: "Pre-delay (s)" },
    { key: "dampingParam", label: "Damping (Hz)" },
  ],
  pitchShift: [],
  softClip: [{ key: "outputGainParam", label: "Output gain" }],
  hardClip: [{ key: "outputGainParam", label: "Output gain" }],
  overdrive: [{ key: "outputGainParam", label: "Output gain" }],
  waveFolder: [{ key: "outputGainParam", label: "Output gain" }],
  fuzz: [{ key: "outputGainParam", label: "Output gain" }],
  foldbackDistortion: [{ key: "outputGainParam", label: "Output gain" }],
  rectifier: [{ key: "outputGainParam", label: "Output gain" }],
  tapeSaturation: [{ key: "outputGainParam", label: "Output gain" }],
  sampleRateReducer: [{ key: "outputGainParam", label: "Output gain" }],
  parametricWaveshaper: [{ key: "outputGainParam", label: "Output gain" }],
};

/** The modulatable AudioParam options for one effect type -- empty for a
 * type with nothing exposed (e.g. "gain", "pitchShift"), never undefined. */
export function getEffectParamOptions(type: EffectType): EffectParamOption[] {
  return EFFECT_PARAM_OPTIONS[type];
}
