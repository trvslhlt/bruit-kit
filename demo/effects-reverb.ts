import { ReverbEffect } from "../src/audio/reverbEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const reverb = new ReverbEffect(audioContext);
  reverb.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, reverb);

  renderParamPanel(paramsEl, [
    {
      id: "decaySeconds",
      label: "Decay (s)",
      min: 0.1,
      max: 8,
      step: 0.1,
      value: 2,
      onChange: (value) => reverb.setParams({ decaySeconds: value }),
    },
    {
      id: "preDelayMs",
      label: "Pre-delay (ms)",
      min: 0,
      max: 200,
      step: 1,
      value: 20,
      onChange: (value) => reverb.setParams({ preDelayMs: value }),
    },
    {
      id: "dampingHz",
      label: "Damping (Hz)",
      min: 500,
      max: 12000,
      step: 100,
      value: 6000,
      onChange: (value) => reverb.setParams({ dampingHz: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => reverb.setParams({ wet: value }),
    },
  ]);
});
