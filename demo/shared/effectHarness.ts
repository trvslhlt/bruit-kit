import { OscillatorSynth } from "../../src/sources/oscillatorSynth";
import { connectToOutput } from "./audioContext";
import { createOnScreenKeyboard } from "./keyboard";

export interface EffectNode {
  input: AudioNode;
  output: AudioNode;
}

/** The wiring shared by every effects/*.ts demo: an OscillatorSynth +
 * on-screen keyboard as the signal source, routed through `effect`, routed
 * to output. Each demo still builds its own effect instance (constructors
 * differ) and param panel — only this part is identical enough across all
 * eight to be worth sharing. */
export function wireEffectDemo(
  audioContext: AudioContext,
  keyboardContainer: HTMLElement,
  effect: EffectNode,
): OscillatorSynth {
  const synth = new OscillatorSynth(audioContext);
  synth.output.connect(effect.input);
  connectToOutput(effect.output, audioContext);
  createOnScreenKeyboard(keyboardContainer, synth);
  return synth;
}
