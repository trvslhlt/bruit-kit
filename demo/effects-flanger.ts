import { FlangerEffect } from "../src/audio/flangerEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const flanger = new FlangerEffect(audioContext);
  flanger.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, flanger);

  renderParamPanel(paramsEl, [
    {
      id: "rate",
      label: "Rate (Hz)",
      min: 0.05,
      max: 5,
      step: 0.05,
      value: 0.25,
      onChange: (value) => flanger.setParams({ rate: value }),
    },
    {
      id: "depth",
      label: "Depth (ms)",
      min: 0,
      max: 5,
      step: 0.1,
      value: 2,
      onChange: (value) => flanger.setParams({ depth: value }),
    },
    {
      id: "feedback",
      label: "Feedback",
      min: 0,
      max: 0.95,
      step: 0.01,
      value: 0.5,
      onChange: (value) => flanger.setParams({ feedback: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => flanger.setParams({ wet: value }),
    },
  ]);
});
