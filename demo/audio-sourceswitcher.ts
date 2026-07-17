import { SourceSwitcher } from "../src/audio/sourceSwitcher";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const SOURCE_LABELS = ["A (sine, low)", "B (square, high)"];

unlockAudioContext(unlockEl).then((audioContext) => {
  const oscA = audioContext.createOscillator();
  oscA.type = "sine";
  oscA.frequency.value = 220;
  oscA.start();

  const oscB = audioContext.createOscillator();
  oscB.type = "square";
  oscB.frequency.value = 440;
  oscB.start();

  const switcher = new SourceSwitcher(
    audioContext,
    [
      { node: oscA, weight: 1 },
      { node: oscB, weight: 1 },
    ],
    { holdMinMs: 1500, holdMaxMs: 4000, transitionMs: 400 },
  );
  connectToOutput(switcher.output, audioContext);

  switcher.onSwitch((index) => {
    statusEl.textContent = `Active source: ${SOURCE_LABELS[index]}`;
  });

  const weights = [1, 1];

  renderParamPanel(paramsEl, [
    {
      id: "weightA",
      label: "Weight A",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => {
        weights[0] = value;
        switcher.setParams({ weights: [...weights] });
      },
    },
    {
      id: "weightB",
      label: "Weight B",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => {
        weights[1] = value;
        switcher.setParams({ weights: [...weights] });
      },
    },
    {
      id: "holdMinMs",
      label: "Hold min (ms)",
      min: 100,
      max: 5000,
      step: 100,
      value: 1500,
      onChange: (value) => switcher.setParams({ holdMinMs: value }),
    },
    {
      id: "holdMaxMs",
      label: "Hold max (ms)",
      min: 100,
      max: 8000,
      step: 100,
      value: 4000,
      onChange: (value) => switcher.setParams({ holdMaxMs: value }),
    },
    {
      id: "transitionMs",
      label: "Transition (ms)",
      min: 10,
      max: 2000,
      step: 10,
      value: 400,
      onChange: (value) => switcher.setParams({ transitionMs: value }),
    },
  ]);
});
