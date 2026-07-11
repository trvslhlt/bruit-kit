import type { NoteTarget } from "../../src/midi/noteTarget";
import { connectToOutput } from "./audioContext";
import { createOnScreenKeyboard } from "./keyboard";

export interface SourceNode extends NoteTarget {
  output: AudioNode;
}

/** The wiring shared by every sources/*.ts demo: connect the source's
 * output through the shared limiter, and drive it with the on-screen
 * keyboard. Simpler than effectHarness.ts's version since a source *is*
 * the NoteTarget — no separate synth feeding into it. */
export function wireSourceDemo(
  audioContext: AudioContext,
  keyboardContainer: HTMLElement,
  source: SourceNode,
): void {
  connectToOutput(source.output, audioContext);
  createOnScreenKeyboard(keyboardContainer, source);
}
