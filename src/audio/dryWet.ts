export interface DryWetWrapper {
  input: AudioNode;
  output: AudioNode;
  setWet(wet: number): void;
}

/** Wires a dry/wet crossfade around a caller-built "wet" processing
 * subgraph, so every effect gets the same bypass-at-0/full-effect-at-1
 * behavior without repeating the gain-node plumbing four times. `wetChainInput`
 * and `wetChainOutput` are the first and last node of that subgraph — the
 * same node for a single-node effect (a filter), different nodes for a
 * multi-node one (pre-delay -> convolver -> damping filter). */
export function createDryWet(
  audioContext: AudioContext,
  wetChainInput: AudioNode,
  wetChainOutput: AudioNode,
  initialWet = 0,
): DryWetWrapper {
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const wetGain = audioContext.createGain();

  input.connect(dryGain);
  input.connect(wetChainInput);
  dryGain.connect(output);
  wetChainOutput.connect(wetGain);
  wetGain.connect(output);

  function setWet(wet: number): void {
    const clamped = Math.min(Math.max(wet, 0), 1);
    dryGain.gain.value = 1 - clamped;
    wetGain.gain.value = clamped;
  }
  setWet(initialWet);

  return { input, output, setWet };
}
