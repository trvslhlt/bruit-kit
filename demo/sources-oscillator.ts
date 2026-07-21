import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const selectEl = document.querySelector<HTMLDivElement>("#select")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const WAVEFORMS = ["sawtooth", "sine", "square", "triangle"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  wireSourceDemo(audioContext, keyboardEl, synth);

  renderSelect(selectEl, "Waveform", WAVEFORMS, "sawtooth", (waveform) =>
    synth.setParams({ waveform }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "detune",
      label: "Detune (cents)",
      min: -1200,
      max: 1200,
      step: 1,
      value: 0,
      onChange: (value) => synth.setParams({ detune: value }),
    },
    {
      id: "attackMs",
      label: "Attack (ms)",
      min: 0,
      max: 1000,
      step: 1,
      value: 5,
      onChange: (value) => synth.setParams({ attackMs: value }),
    },
    {
      id: "decayMs",
      label: "Decay (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 150,
      onChange: (value) => synth.setParams({ decayMs: value }),
    },
    {
      id: "sustainLevel",
      label: "Sustain",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.7,
      onChange: (value) => synth.setParams({ sustainLevel: value }),
    },
    {
      id: "releaseMs",
      label: "Release (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 200,
      onChange: (value) => synth.setParams({ releaseMs: value }),
    },
    {
      id: "portamentoMs",
      label: "Portamento (ms)",
      min: 0,
      max: 1000,
      step: 1,
      value: 0,
      onChange: (value) => synth.setParams({ portamentoMs: value }),
    },
  ]);
});
