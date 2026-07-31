import { FuzzEffect } from "../src/audio/fuzzEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const fuzz = new FuzzEffect(audioContext);
  fuzz.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, fuzz);

  renderParamPanel(paramsEl, [
    {
      id: "drive",
      label: "Drive",
      min: 0.1,
      max: 30,
      step: 0.1,
      value: 10,
      onChange: (value) => fuzz.setParams({ drive: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => fuzz.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => fuzz.setParams({ wet: value }),
    },
  ]);
});
