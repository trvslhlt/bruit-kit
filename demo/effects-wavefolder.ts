import { WaveFolderEffect } from "../src/audio/waveFolderEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const waveFolder = new WaveFolderEffect(audioContext);
  waveFolder.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, waveFolder);

  renderParamPanel(paramsEl, [
    {
      id: "fold",
      label: "Fold",
      min: 0.1,
      max: 10,
      step: 0.1,
      value: 3,
      onChange: (value) => waveFolder.setParams({ fold: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => waveFolder.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => waveFolder.setParams({ wet: value }),
    },
  ]);
});
