// Modulation-domain types — kept separate from any concrete synth so the
// LFO engine (lfoEngine.ts) never needs to know about a specific synth
// implementation. Anything that can accept a worklet-side modulation
// assignment just needs to structurally satisfy ModulatableWorkletSynth.

export type LfoShape = "sine" | "triangle" | "square" | "sawtooth";

/** One LFO slot's config for a worklet-internal target — a param computed
 * inside an AudioWorkletProcessor each render block, as opposed to a native
 * AudioParam. depth/min/max are already in the target's real units (see
 * targetRegistry.ts's depthPercentToUnits), not raw percentages — the
 * worklet has no idea what a "percent depth" means for a given param, so
 * that conversion happens before this reaches it. */
export interface WorkletModulationConfig {
  target: string;
  shape: LfoShape;
  rateHz: number;
  depth: number;
  min: number;
  max: number;
}

/** The minimal shape lfoEngine.ts needs from a synth to drive
 * worklet-internal modulation targets — deliberately not a concrete synth
 * class, so the engine works with any worklet-backed synth that implements
 * this, not just one specific implementation. */
export interface ModulatableWorkletSynth {
  setModulation(slot: number, config: WorkletModulationConfig | null): void;
}
