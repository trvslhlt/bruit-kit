import {
  SampleRateReducerEffect,
  preloadSampleRateReducerWorklet,
} from "../src/audio/sampleRateReducerEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then(async (audioContext) => {
  await preloadSampleRateReducerWorklet(audioContext);

  const sampleRateReducer = new SampleRateReducerEffect(audioContext);
  sampleRateReducer.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, sampleRateReducer);

  renderParamPanel(paramsEl, [
    {
      id: "holdSamples",
      label: "Hold samples",
      min: 1,
      max: 50,
      step: 1,
      value: 4,
      onChange: (value) => sampleRateReducer.setParams({ holdSamples: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => sampleRateReducer.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => sampleRateReducer.setParams({ wet: value }),
    },
  ]);
});
