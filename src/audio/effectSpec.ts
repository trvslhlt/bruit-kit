/** The declarative shape of one effect instance in a chain -- type + params
 * (opaque numbers/strings keyed by that effect's own param names) plus two
 * optional pieces of UI-driven state (paramRanges, drift). Nothing here
 * references rows/cells/patches or any other grid-sequencer concept: this
 * is a standalone "one entry in an effects chain" vocabulary that the
 * effect-table UI (effectTable.ts/effectsFields), the chain builder
 * (effectsChainBuilder.ts), and offline rendering (offlineRendering.ts) all
 * share, independent of what's driving them. */

export type EffectType =
  | "filter"
  | "gain"
  | "delay"
  | "distortion"
  | "compressor"
  | "tremolo"
  | "ringMod"
  | "chorus"
  | "flanger"
  | "phaser"
  | "autoWah"
  | "bitcrusher"
  | "reverb"
  | "pitchShift"
  | "softClip"
  | "hardClip"
  | "overdrive"
  | "waveFolder"
  | "fuzz"
  | "foldbackDistortion"
  | "rectifier"
  | "tapeSaturation"
  | "sampleRateReducer"
  | "parametricWaveshaper";

export interface EffectSpec {
  type: EffectType;
  params: Record<string, number | string>;
  /** Per-instance custom min/max for this effect's own numeric params --
   * narrower or wider than effectTable.ts's default slider range (see its
   * own hardBoundFor), always clamped to that param's own hard bound
   * regardless of what's set here. Absent, or missing a given param's key,
   * falls back to the table's default range for that param. Scoped to this
   * one effect instance (this row/cell/master/send-bus slot's own copy of
   * the effect), not shared with any other instance of the same effect
   * type elsewhere in the patch. */
  paramRanges?: Record<string, { min: number; max: number }>;
  /** Which of this effect instance's own numeric params should slowly
   * random-walk on their own while playing (see driftEngine.ts), wandering
   * within whatever range is active for that param (paramRanges' custom
   * range if set, else the table default), plus each one's own `speed`
   * (0..1, default 0.5 -- higher retargets more often and glides faster
   * toward each new target, lower is slower and more glacial). This is the
   * intent to persist -- not the live wandering value itself, which is
   * pushed straight to the running effect instance and never written back
   * here. */
  drift?: Record<string, { speed: number }>;
}
