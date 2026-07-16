import { AutoWahEffect } from "../src/audio/autoWahEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const autoWah = new AutoWahEffect(audioContext);
  autoWah.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, autoWah);

  renderParamPanel(paramsEl, [
    {
      id: "baseFrequency",
      label: "Base frequency",
      min: 100,
      max: 2000,
      step: 10,
      value: 500,
      onChange: (value) => autoWah.setParams({ baseFrequency: value }),
    },
    {
      id: "q",
      label: "Q",
      min: 0.5,
      max: 15,
      step: 0.1,
      value: 6,
      onChange: (value) => autoWah.setParams({ q: value }),
    },
    {
      id: "sensitivity",
      label: "Sensitivity",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.7,
      onChange: (value) => autoWah.setParams({ sensitivity: value }),
    },
    {
      id: "attackHz",
      label: "Follower speed (Hz)",
      min: 1,
      max: 50,
      step: 1,
      value: 15,
      onChange: (value) => autoWah.setParams({ attackHz: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => autoWah.setParams({ wet: value }),
    },
  ]);
});
