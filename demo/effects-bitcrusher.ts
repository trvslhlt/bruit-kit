import { BitcrusherEffect } from "../src/audio/bitcrusherEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const bitcrusher = new BitcrusherEffect(audioContext);
  bitcrusher.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, bitcrusher);

  renderParamPanel(paramsEl, [
    {
      id: "bits",
      label: "Bits",
      min: 1,
      max: 16,
      step: 1,
      value: 6,
      onChange: (value) => bitcrusher.setParams({ bits: value }),
    },
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => bitcrusher.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => bitcrusher.setParams({ wet: value }),
    },
  ]);
});
