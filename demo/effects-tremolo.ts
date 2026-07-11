import { TremoloEffect } from "../src/audio/tremoloEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const WAVEFORMS = ["sine", "square"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const tremolo = new TremoloEffect(audioContext);
  tremolo.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, tremolo);

  renderSelect(selectEl, "Waveform", WAVEFORMS, "sine", (waveform) =>
    tremolo.setParams({ waveform }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "rate",
      label: "Rate (Hz)",
      min: 0.1,
      max: 20,
      step: 0.1,
      value: 5,
      onChange: (value) => tremolo.setParams({ rate: value }),
    },
    {
      id: "depth",
      label: "Depth",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => tremolo.setParams({ depth: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => tremolo.setParams({ wet: value }),
    },
  ]);
});
