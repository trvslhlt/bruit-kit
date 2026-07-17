/** Picks an index from `weights` proportional to its share of the total —
 * weights don't need to sum to 1, they're normalized against each other
 * (so `[2, 1]` and `[0.4, 0.2]` behave identically). Negative weights are
 * treated as 0 rather than thrown on, since a caller driving this from a
 * live UI slider shouldn't be able to crash it mid-drag. An all-zero (or
 * empty) `weights` falls back to a uniform pick across every index, rather
 * than dividing by zero and always returning the same fixed index.
 *
 * `random` defaults to `Math.random` but is overridable so callers (and
 * their tests) can inject a seeded/deterministic source instead. */
export function weightedRandomIndex(
  weights: number[],
  random: () => number = Math.random,
): number {
  const total = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (total <= 0) {
    return Math.floor(random() * weights.length);
  }
  let threshold = random() * total;
  for (let i = 0; i < weights.length; i++) {
    threshold -= Math.max(weights[i], 0);
    if (threshold <= 0) return i;
  }
  // Floating-point rounding can leave `threshold` a hair above 0 after the
  // loop even though it mathematically shouldn't -- the last index is the
  // only reasonable fallback since the loop already spent the whole total.
  return weights.length - 1;
}
