import { CombFilterEffect } from "../src/audio/combFilterEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const combFilter = new CombFilterEffect(audioContext);
  combFilter.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, combFilter);

  renderParamPanel(paramsEl, [
    {
      id: "frequency",
      label: "Frequency (Hz)",
      min: 20,
      max: 2000,
      step: 1,
      value: 440,
      onChange: (value) => combFilter.setParams({ frequency: value }),
    },
    {
      id: "feedback",
      label: "Feedback",
      min: -0.95,
      max: 0.95,
      step: 0.01,
      value: 0.7,
      onChange: (value) => combFilter.setParams({ feedback: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => combFilter.setParams({ wet: value }),
    },
  ]);
});
