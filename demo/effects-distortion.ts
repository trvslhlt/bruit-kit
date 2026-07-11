import { DistortionEffect } from "../src/audio/distortionEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const distortion = new DistortionEffect(audioContext);
  distortion.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, distortion);

  renderParamPanel(paramsEl, [
    {
      id: "amount",
      label: "Amount",
      min: 0,
      max: 100,
      step: 1,
      value: 20,
      onChange: (value) => distortion.setParams({ amount: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => distortion.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => distortion.setParams({ wet: value }),
    },
  ]);
});
