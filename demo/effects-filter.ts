import { FilterEffect } from "../src/audio/filterEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const FILTER_TYPES = ["lowpass", "highpass", "bandpass", "notch"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const filter = new FilterEffect(audioContext);
  filter.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, filter);

  renderSelect(selectEl, "Type", FILTER_TYPES, "lowpass", (type) =>
    filter.setParams({ type }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "frequency",
      label: "Frequency",
      min: 80,
      max: 12000,
      step: 10,
      value: 8000,
      onChange: (value) => filter.setParams({ frequency: value }),
    },
    {
      id: "q",
      label: "Q",
      min: 0.1,
      max: 20,
      step: 0.1,
      value: 0.7,
      onChange: (value) => filter.setParams({ q: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => filter.setParams({ wet: value }),
    },
  ]);
});
