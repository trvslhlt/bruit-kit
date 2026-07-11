import { FmSynth } from "../src/sources/fmSynth";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const carrierSelectEl =
  document.querySelector<HTMLDivElement>("#select-carrier")!;
const modulatorSelectEl =
  document.querySelector<HTMLDivElement>("#select-modulator")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const WAVEFORMS = ["sine", "triangle", "sawtooth", "square"] as const;

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new FmSynth(audioContext);
  wireSourceDemo(audioContext, keyboardEl, synth);

  renderSelect(
    carrierSelectEl,
    "Carrier waveform",
    WAVEFORMS,
    "sine",
    (carrierWaveform) => synth.setParams({ carrierWaveform }),
  );
  renderSelect(
    modulatorSelectEl,
    "Modulator waveform",
    WAVEFORMS,
    "sine",
    (modulatorWaveform) => synth.setParams({ modulatorWaveform }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "harmonicity",
      label: "Harmonicity",
      min: 0.1,
      max: 8,
      step: 0.01,
      value: 2,
      onChange: (value) => synth.setParams({ harmonicity: value }),
    },
    {
      id: "modulationIndex",
      label: "Mod index (Hz)",
      min: 0,
      max: 1000,
      step: 1,
      value: 100,
      onChange: (value) => synth.setParams({ modulationIndex: value }),
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
      value: 200,
      onChange: (value) => synth.setParams({ decayMs: value }),
    },
    {
      id: "sustainLevel",
      label: "Sustain",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.6,
      onChange: (value) => synth.setParams({ sustainLevel: value }),
    },
    {
      id: "releaseMs",
      label: "Release (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 250,
      onChange: (value) => synth.setParams({ releaseMs: value }),
    },
  ]);
});
