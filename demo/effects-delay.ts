import { DelayEffect } from "../src/audio/delayEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const delay = new DelayEffect(audioContext);
  delay.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, delay);

  renderParamPanel(paramsEl, [
    {
      id: "delayMs",
      label: "Delay (ms)",
      min: 10,
      max: 2500,
      step: 10,
      value: 300,
      onChange: (value) => delay.setParams({ delayMs: value }),
    },
    {
      id: "feedback",
      label: "Feedback",
      min: 0,
      max: 0.95,
      step: 0.01,
      value: 0.35,
      onChange: (value) => delay.setParams({ feedback: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => delay.setParams({ wet: value }),
    },
  ]);
});
