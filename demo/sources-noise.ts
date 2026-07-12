import { NoiseGenerator } from "../src/sources/noiseGenerator";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const NOISE_TYPES = ["white", "pink", "brown"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const noise = new NoiseGenerator(audioContext);
  wireSourceDemo(audioContext, keyboardEl, noise);

  renderSelect(selectEl, "Type", NOISE_TYPES, "white", (type) =>
    noise.setParams({ type }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "attackMs",
      label: "Attack (ms)",
      min: 0,
      max: 1000,
      step: 1,
      value: 5,
      onChange: (value) => noise.setParams({ attackMs: value }),
    },
    {
      id: "decayMs",
      label: "Decay (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 100,
      onChange: (value) => noise.setParams({ decayMs: value }),
    },
    {
      id: "sustainLevel",
      label: "Sustain",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.8,
      onChange: (value) => noise.setParams({ sustainLevel: value }),
    },
    {
      id: "releaseMs",
      label: "Release (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 150,
      onChange: (value) => noise.setParams({ releaseMs: value }),
    },
  ]);
});
