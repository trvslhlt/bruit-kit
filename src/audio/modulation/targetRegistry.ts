// Generic modulation-target infrastructure. The actual list of targets
// (what params exist, their labels/groups/bounds) is app-specific and
// deliberately NOT defined here — the consuming app builds its own
// ModulationTarget[] and passes it to createLfoEngine (see lfoEngine.ts)
// and whatever UI it builds (e.g. a grouped destination <select>).

export type ModulationTargetKind = "worklet" | "audioParam";

export interface ModulationTarget {
  id: string;
  label: string;
  /** Free-form grouping label for UI purposes (e.g. building a grouped
   * destination <select>) — not a fixed set, since that's app-specific. */
  group: string;
  kind: ModulationTargetKind;
  min: number;
  max: number;
}

export function getModulationTarget(
  targets: ModulationTarget[],
  id: string,
): ModulationTarget | undefined {
  return targets.find((t) => t.id === id);
}

/** Converts a 0-100 depth slider into the target's real units: the LFO
 * swings +/- this amount around whatever the param's own base value is. */
export function depthPercentToUnits(
  target: ModulationTarget,
  depthPercent: number,
): number {
  return ((target.max - target.min) / 2) * (depthPercent / 100);
}
