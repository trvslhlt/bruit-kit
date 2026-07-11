// Shared, stateless sequencing logic used by both the live keyboard
// arpeggiator (arpeggiator.ts) and the MIDI-file arpeggiator transform
// (fileTransforms.ts) — the two have genuinely different scheduling models
// (live vs. precomputed-duration), but "given a set of notes, a pattern, and
// an octave range, what order do they play in" is identical either way.

export type ArpPattern = "up" | "down" | "up-down" | "random" | "as-played";

export interface ArpParams {
  rateHz: number;
  pattern: ArpPattern;
  octaves: number;
  gate: number;
}

export interface HeldNote {
  note: number;
  velocity: number;
}

/** Orders the held notes per `pattern` and repeats that ordering across
 * `octaves` octaves upward. Does not itself handle "random" — that's picked
 * fresh at each step by `pickStep`, not baked into a fixed ordering. */
export function buildArpSequence(
  held: HeldNote[],
  pattern: ArpPattern,
  octaves: number,
): HeldNote[] {
  let ordered: HeldNote[];
  switch (pattern) {
    case "up":
      ordered = [...held].sort((a, b) => a.note - b.note);
      break;
    case "down":
      ordered = [...held].sort((a, b) => b.note - a.note);
      break;
    case "up-down": {
      const up = [...held].sort((a, b) => a.note - b.note);
      const down = up.slice(1, -1).reverse();
      ordered = [...up, ...down];
      break;
    }
    default:
      ordered = [...held];
      break;
  }
  if (ordered.length === 0) return [];

  const sequence: HeldNote[] = [];
  for (let octave = 0; octave < Math.max(1, octaves); octave++) {
    for (const entry of ordered) {
      sequence.push({
        note: entry.note + octave * 12,
        velocity: entry.velocity,
      });
    }
  }
  return sequence;
}

export function pickStep(
  sequence: HeldNote[],
  pattern: ArpPattern,
  stepIndex: number,
): HeldNote | null {
  if (sequence.length === 0) return null;
  if (pattern === "random") {
    return sequence[Math.floor(Math.random() * sequence.length)];
  }
  return sequence[stepIndex % sequence.length];
}
