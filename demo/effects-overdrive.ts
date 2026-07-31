import { OverdriveEffect } from "../src/audio/overdriveEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const overdrive = new OverdriveEffect(audioContext);
  overdrive.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, overdrive);

  renderParamPanel(paramsEl, [
    {
      id: "drive",
      label: "Drive",
      min: 0.1,
      max: 20,
      step: 0.1,
      value: 5,
      onChange: (value) => overdrive.setParams({ drive: value }),
    },
    {
      id: "asymmetry",
      label: "Asymmetry",
      min: -1,
      max: 1,
      step: 0.01,
      value: 0.3,
      onChange: (value) => overdrive.setParams({ asymmetry: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => overdrive.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => overdrive.setParams({ wet: value }),
    },
  ]);
});
