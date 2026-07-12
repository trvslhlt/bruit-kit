export interface ChainableNode {
  input: AudioNode;
  output: AudioNode;
}

/** Wires an ordered list of {input, output} nodes in series and returns
 * the combined pair — every effect in this toolkit already has this shape
 * (FilterEffect, DelayEffect, etc.), so building a chain from a cascaded
 * config is `chainEffects(audioContext, [filter, delay, distortion])`
 * instead of hand-wiring `a.output.connect(b.input)` per pair. An empty
 * list is a valid no-op passthrough (a single GainNode, input === output);
 * a single effect is returned as-is with no extra node added. */
export function chainEffects(
  audioContext: AudioContext,
  effects: ChainableNode[],
): ChainableNode {
  if (effects.length === 0) {
    const passthrough = audioContext.createGain();
    return { input: passthrough, output: passthrough };
  }
  if (effects.length === 1) {
    return effects[0];
  }
  for (let i = 0; i < effects.length - 1; i++) {
    effects[i].output.connect(effects[i + 1].input);
  }
  return {
    input: effects[0].input,
    output: effects[effects.length - 1].output,
  };
}
