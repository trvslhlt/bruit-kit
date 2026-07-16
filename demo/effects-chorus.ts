import { ChorusEffect } from "../src/audio/chorusEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const chorus = new ChorusEffect(audioContext);
  chorus.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, chorus);

  renderParamPanel(paramsEl, [
    {
      id: "rate",
      label: "Rate (Hz)",
      min: 0.05,
      max: 5,
      step: 0.05,
      value: 0.8,
      onChange: (value) => chorus.setParams({ rate: value }),
    },
    {
      id: "depth",
      label: "Depth (ms)",
      min: 0,
      max: 20,
      step: 0.5,
      value: 3,
      onChange: (value) => chorus.setParams({ depth: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => chorus.setParams({ wet: value }),
    },
  ]);
});
