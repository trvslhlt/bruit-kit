import { RingModulationEffect } from "../src/audio/ringModulationEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const WAVEFORMS = ["sine", "square", "sawtooth"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const ringMod = new RingModulationEffect(audioContext);
  ringMod.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, ringMod);

  renderSelect(selectEl, "Waveform", WAVEFORMS, "sine", (waveform) =>
    ringMod.setParams({ waveform }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "frequency",
      label: "Frequency (Hz)",
      min: 1,
      max: 2000,
      step: 1,
      value: 30,
      onChange: (value) => ringMod.setParams({ frequency: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => ringMod.setParams({ wet: value }),
    },
  ]);
});
