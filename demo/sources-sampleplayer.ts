import { SamplePlayer } from "../src/sources/samplePlayer";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const loopToggleEl = document.querySelector<HTMLInputElement>("#loop-toggle")!;
const oneshotToggleEl =
  document.querySelector<HTMLInputElement>("#oneshot-toggle")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const player = new SamplePlayer(audioContext);
  player.setParams({ loop: true, oneShot: false });
  player.loadSample(createTestBuffer(audioContext));
  wireSourceDemo(audioContext, keyboardEl, player);

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    player.loadSample(buffer);
  });

  loopToggleEl.addEventListener("change", () =>
    player.setParams({ loop: loopToggleEl.checked }),
  );
  oneshotToggleEl.addEventListener("change", () =>
    player.setParams({ oneShot: oneshotToggleEl.checked }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "rootNote",
      label: "Root note",
      min: 24,
      max: 96,
      step: 1,
      value: 60,
      onChange: (value) => player.setParams({ rootNote: value }),
    },
    {
      id: "attackMs",
      label: "Attack (ms)",
      min: 0,
      max: 1000,
      step: 1,
      value: 5,
      onChange: (value) => player.setParams({ attackMs: value }),
    },
    {
      id: "decayMs",
      label: "Decay (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 0,
      onChange: (value) => player.setParams({ decayMs: value }),
    },
    {
      id: "sustainLevel",
      label: "Sustain",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => player.setParams({ sustainLevel: value }),
    },
    {
      id: "releaseMs",
      label: "Release (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 100,
      onChange: (value) => player.setParams({ releaseMs: value }),
    },
  ]);
});
