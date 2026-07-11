import { CompressorEffect } from "../src/audio/compressorEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const compressor = new CompressorEffect(audioContext);
  compressor.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, compressor);

  renderParamPanel(paramsEl, [
    {
      id: "threshold",
      label: "Threshold (dB)",
      min: -60,
      max: 0,
      step: 1,
      value: -24,
      onChange: (value) => compressor.setParams({ threshold: value }),
    },
    {
      id: "ratio",
      label: "Ratio",
      min: 1,
      max: 20,
      step: 0.5,
      value: 12,
      onChange: (value) => compressor.setParams({ ratio: value }),
    },
    {
      id: "attack",
      label: "Attack (s)",
      min: 0,
      max: 1,
      step: 0.001,
      value: 0.003,
      onChange: (value) => compressor.setParams({ attack: value }),
    },
    {
      id: "release",
      label: "Release (s)",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.25,
      onChange: (value) => compressor.setParams({ release: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => compressor.setParams({ wet: value }),
    },
  ]);
});
