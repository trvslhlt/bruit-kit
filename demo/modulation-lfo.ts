import { DelayEffect } from "../src/audio/delayEffect";
import { FilterEffect } from "../src/audio/filterEffect";
import {
  type LfoSlotConfig,
  createLfoEngine,
} from "../src/audio/modulation/lfoEngine";
import type { ModulationTarget } from "../src/audio/modulation/targetRegistry";
import type {
  LfoShape,
  ModulatableWorkletSynth,
} from "../src/audio/modulation/types";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const enabledToggleEl =
  document.querySelector<HTMLInputElement>("#enabled-toggle")!;
const targetSelectEl =
  document.querySelector<HTMLDivElement>("#target-select")!;
const shapeSelectEl = document.querySelector<HTMLDivElement>("#shape-select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const SHAPES = [
  "sine",
  "triangle",
  "square",
  "sawtooth",
] as const satisfies readonly LfoShape[];

// This demo never assigns a "worklet" target, so setModulation is never
// actually called — a no-op stub is all createLfoEngine needs structurally.
const stubSynth: ModulatableWorkletSynth = {
  setModulation() {},
};

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  const filter = new FilterEffect(audioContext);
  const delay = new DelayEffect(audioContext);
  filter.setParams({ wet: 1, type: "lowpass", frequency: 1500, q: 4 });
  delay.setParams({ wet: 0.5, delayMs: 280, feedback: 0.4 });

  synth.output.connect(filter.input);
  filter.output.connect(delay.input);
  connectToOutput(delay.output, audioContext);
  createOnScreenKeyboard(keyboardEl, synth);

  const targets: ModulationTarget[] = [
    {
      id: "filterFreq",
      label: "Filter frequency",
      group: "Filter",
      kind: "audioParam",
      min: 200,
      max: 6000,
    },
    {
      id: "delayFeedback",
      label: "Delay feedback",
      group: "Delay",
      kind: "audioParam",
      min: 0,
      max: 0.9,
    },
  ];
  const audioParams: Record<string, AudioParam> = {
    filterFreq: filter.frequencyParam,
    delayFeedback: delay.feedbackParam,
  };

  const lfoEngine = createLfoEngine(
    audioContext,
    stubSynth,
    audioParams,
    targets,
  );

  const config: LfoSlotConfig = {
    enabled: enabledToggleEl.checked,
    targetId: targets[0].id,
    shape: "sine",
    rateHz: 2,
    depthPercent: 50,
  };
  function apply(): void {
    lfoEngine.setSlot(0, config);
  }
  apply();

  enabledToggleEl.addEventListener("change", () => {
    config.enabled = enabledToggleEl.checked;
    apply();
  });
  renderSelect(
    targetSelectEl,
    "Target",
    targets.map((t) => t.id),
    config.targetId ?? targets[0].id,
    (targetId) => {
      config.targetId = targetId;
      apply();
    },
  );
  renderSelect(shapeSelectEl, "Shape", SHAPES, config.shape, (shape) => {
    config.shape = shape;
    apply();
  });

  renderParamPanel(paramsEl, [
    {
      id: "rateHz",
      label: "Rate (Hz)",
      min: 0.1,
      max: 20,
      step: 0.1,
      value: config.rateHz,
      onChange: (value) => {
        config.rateHz = value;
        apply();
      },
    },
    {
      id: "depthPercent",
      label: "Depth (%)",
      min: 0,
      max: 100,
      step: 1,
      value: config.depthPercent,
      onChange: (value) => {
        config.depthPercent = value;
        apply();
      },
    },
  ]);
});
