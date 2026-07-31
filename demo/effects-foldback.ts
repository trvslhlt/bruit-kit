import { FoldbackDistortionEffect } from "../src/audio/foldbackDistortionEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const foldback = new FoldbackDistortionEffect(audioContext);
  foldback.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, foldback);

  renderParamPanel(paramsEl, [
    {
      id: "threshold",
      label: "Threshold",
      min: 0.02,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => foldback.setParams({ threshold: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => foldback.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => foldback.setParams({ wet: value }),
    },
  ]);
});
