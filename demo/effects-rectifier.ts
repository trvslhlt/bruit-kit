import {
  type RectifierMode,
  RectifierEffect,
} from "../src/audio/rectifierEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const MODES = ["full", "half"] as const satisfies readonly RectifierMode[];

unlockAudioContext(unlockEl).then((audioContext) => {
  const rectifier = new RectifierEffect(audioContext);
  rectifier.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, rectifier);

  renderSelect(selectEl, "Mode", MODES, "full", (mode) =>
    rectifier.setParams({ mode }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "outputGain",
      label: "Output gain",
      min: 0,
      max: 2,
      step: 0.01,
      value: 1,
      onChange: (value) => rectifier.setParams({ outputGain: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => rectifier.setParams({ wet: value }),
    },
  ]);
});
