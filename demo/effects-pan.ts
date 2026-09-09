import { PanEffect } from "../src/audio/panEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const pan = new PanEffect(audioContext);
  pan.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, pan);

  renderParamPanel(paramsEl, [
    {
      id: "pan",
      label: "Pan",
      min: -1,
      max: 1,
      step: 0.01,
      value: 0,
      onChange: (value) => pan.setParams({ pan: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => pan.setParams({ wet: value }),
    },
  ]);
});
