import { ChordEffect } from "../src/midi/chordEffect";
import type { ChordShapeName } from "../src/midi/chordShapes";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";
import { renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const enabledToggleEl =
  document.querySelector<HTMLInputElement>("#enabled-toggle")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;

const SHAPES = [
  "major",
  "minor",
  "sus4",
  "power",
  "major7",
  "minor7",
  "dom7",
] as const satisfies readonly ChordShapeName[];

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  connectToOutput(synth.output, audioContext);

  const chord = new ChordEffect(synth);
  chord.setEnabled(enabledToggleEl.checked);
  chord.setShape("major");

  enabledToggleEl.addEventListener("change", () =>
    chord.setEnabled(enabledToggleEl.checked),
  );
  renderSelect(selectEl, "Shape", SHAPES, "major", (shape) =>
    chord.setShape(shape),
  );

  createOnScreenKeyboard(keyboardEl, chord);
});
