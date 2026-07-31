import { TapeSaturationEffect } from "../src/audio/tapeSaturationEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const tapeSaturation = new TapeSaturationEffect(audioContext);
  tapeSaturation.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, tapeSaturation);

  renderParamPanel(paramsEl, [
    {
      id: "warmth",
      label: "Warmth",
      min: 0,
      max: 3,
      step: 0.05,
      value: 1,
      onChange: (value) => tapeSaturation.setParams({ warmth: value }),
    },
    {
      id: "tone",
      label: "Tone",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.7,
      onChange: (value) => tapeSaturation.setParams({ tone: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => tapeSaturation.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => tapeSaturation.setParams({ wet: value }),
    },
  ]);
});
