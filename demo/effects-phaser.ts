import { PhaserEffect } from "../src/audio/phaserEffect";
import { unlockAudioContext } from "./shared/audioContext";
import { wireEffectDemo } from "./shared/effectHarness";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const phaser = new PhaserEffect(audioContext);
  phaser.setParams({ wet: 1 });
  wireEffectDemo(audioContext, keyboardEl, phaser);

  renderParamPanel(paramsEl, [
    {
      id: "rate",
      label: "Rate (Hz)",
      min: 0.05,
      max: 5,
      step: 0.05,
      value: 0.3,
      onChange: (value) => phaser.setParams({ rate: value }),
    },
    {
      id: "depth",
      label: "Depth",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => phaser.setParams({ depth: value }),
    },
    {
      id: "feedback",
      label: "Feedback",
      min: 0,
      max: 0.95,
      step: 0.01,
      value: 0.3,
      onChange: (value) => phaser.setParams({ feedback: value }),
    },
    {
      id: "wet",
      label: "Wet",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      onChange: (value) => phaser.setParams({ wet: value }),
    },
  ]);
});
