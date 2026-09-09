// Pure fraction<->value mapping shared by every "you can drag/position
// this control across [min, max]" widget in this module (knob.ts, and
// fields.ts's own <input type="range"> rendering) -- kept here, not
// duplicated per-widget, now that a second real caller needs the exact
// same linear/log curve instead of just a structurally-similar one.

export type RangeScale = "linear" | "log";

/** Silently falls back to "linear" when min <= 0, since a log curve has
 * no meaning below/at zero -- every caller should run a requested scale
 * through this rather than trusting it directly. */
export function effectiveScale(
  scale: RangeScale | undefined,
  min: number,
): RangeScale {
  if (scale !== "log") return "linear";
  return min > 0 ? "log" : "linear";
}

export function fractionToValue(
  fraction: number,
  min: number,
  max: number,
  scale: RangeScale,
): number {
  const f = Math.min(1, Math.max(0, fraction));
  if (scale === "log") return min * (max / min) ** f;
  return min + f * (max - min);
}

export function valueToFraction(
  value: number,
  min: number,
  max: number,
  scale: RangeScale,
): number {
  if (scale === "log") return Math.log(value / min) / Math.log(max / min);
  return (value - min) / (max - min);
}

export function snapToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

/** Decimals-from-step heuristic shared by every numeric readout in this
 * module (a knob's own value label, a slider's field-value span). */
export function formatRangeValue(value: number, step: number): string {
  const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
  return value.toFixed(decimals);
}
