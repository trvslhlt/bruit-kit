import { ParametricWaveshaperEffect } from "../src/audio/parametricWaveshaperEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const waveshaper = new ParametricWaveshaperEffect(audioContext);
  waveshaper.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, waveshaper);

  renderParamPanel(paramsEl, [
    {
      id: "pointAtNegOne",
      label: "Point at -1",
      min: -1,
      max: 1,
      step: 0.01,
      value: -1,
      onChange: (value) => waveshaper.setParams({ pointAtNegOne: value }),
    },
    {
      id: "pointAtNegHalf",
      label: "Point at -0.5",
      min: -1,
      max: 1,
      step: 0.01,
      value: -0.5,
      onChange: (value) => waveshaper.setParams({ pointAtNegHalf: value }),
    },
    {
      id: "pointAtZero",
      label: "Point at 0",
      min: -1,
      max: 1,
      step: 0.01,
      value: 0,
      onChange: (value) => waveshaper.setParams({ pointAtZero: value }),
    },
    {
      id: "pointAtHalf",
      label: "Point at 0.5",
      min: -1,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => waveshaper.setParams({ pointAtHalf: value }),
    },
    {
      id: "pointAtOne",
      label: "Point at 1",
      min: -1,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => waveshaper.setParams({ pointAtOne: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => waveshaper.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => waveshaper.setParams({ wet: value }),
    },
  ]);
});
