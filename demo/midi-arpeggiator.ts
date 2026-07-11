import type { ArpPattern } from "../src/midi/arpPatterns";
import { ArpeggiatorEffect } from "../src/midi/arpeggiator";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const enabledToggleEl =
  document.querySelector<HTMLInputElement>("#enabled-toggle")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;

const PATTERNS = [
  "up",
  "down",
  "up-down",
  "random",
  "as-played",
] as const satisfies readonly ArpPattern[];

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  connectToOutput(synth.output, audioContext);

  const arp = new ArpeggiatorEffect(synth);
  arp.setEnabled(enabledToggleEl.checked);
  enabledToggleEl.addEventListener("change", () =>
    arp.setEnabled(enabledToggleEl.checked),
  );

  renderSelect(selectEl, "Pattern", PATTERNS, "up", (pattern) =>
    arp.setParams({ pattern }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "rateHz",
      label: "Rate (Hz)",
      min: 1,
      max: 20,
      step: 0.5,
      value: 8,
      onChange: (value) => arp.setParams({ rateHz: value }),
    },
    {
      id: "octaves",
      label: "Octaves",
      min: 1,
      max: 4,
      step: 1,
      value: 1,
      onChange: (value) => arp.setParams({ octaves: value }),
    },
    {
      id: "gate",
      label: "Gate",
      min: 0.1,
      max: 1,
      step: 0.01,
      value: 0.7,
      onChange: (value) => arp.setParams({ gate: value }),
    },
  ]);

  createOnScreenKeyboard(keyboardEl, arp);
});
