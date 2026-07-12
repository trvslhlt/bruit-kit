import { chainEffects } from "../src/audio/chainEffects";
import { DistortionEffect } from "../src/audio/distortionEffect";
import { FilterEffect } from "../src/audio/filterEffect";
import { ReverbEffect } from "../src/audio/reverbEffect";
import { createSend } from "../src/audio/send";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardAEl = document.querySelector<HTMLDivElement>("#keyboard-a")!;
const paramsAEl = document.querySelector<HTMLDivElement>("#params-a")!;
const keyboardBEl = document.querySelector<HTMLDivElement>("#keyboard-b")!;
const paramsBEl = document.querySelector<HTMLDivElement>("#params-b")!;
const paramsReverbEl =
  document.querySelector<HTMLDivElement>("#params-reverb")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  // One shared reverb bus -- one ConvolverNode total, regardless of how
  // many rows send into it. Fully wet: the "dry" contribution to the mix
  // already happens via each row's own direct connectToOutput below, so
  // mixing more dry back in through the reverb's own crossfade would
  // double it up.
  const reverb = new ReverbEffect(audioContext);
  reverb.setParams({ wet: 1, decaySeconds: 2.5, dampingHz: 6000 });
  connectToOutput(reverb.output, audioContext);

  // Row A: persistent filter -> distortion insert chain, plus a send into
  // the shared reverb.
  const synthA = new OscillatorSynth(audioContext);
  const filterA = new FilterEffect(audioContext);
  filterA.setParams({ wet: 1, type: "lowpass", frequency: 4000, q: 1 });
  const distortionA = new DistortionEffect(audioContext);
  distortionA.setParams({ wet: 1, amount: 15, outputGain: 1 });
  const chainA = chainEffects(audioContext, [filterA, distortionA]);
  synthA.output.connect(chainA.input);
  connectToOutput(chainA.output, audioContext);
  const sendA = createSend(audioContext, reverb.input, 0.2);
  chainA.output.connect(sendA.input);
  createOnScreenKeyboard(keyboardAEl, synthA);

  // Row B: just a filter insert, its own independent send level.
  const synthB = new OscillatorSynth(audioContext);
  synthB.setParams({ waveform: "sine" });
  const filterB = new FilterEffect(audioContext);
  filterB.setParams({ wet: 1, type: "lowpass", frequency: 2000, q: 1 });
  const chainB = chainEffects(audioContext, [filterB]);
  synthB.output.connect(chainB.input);
  connectToOutput(chainB.output, audioContext);
  const sendB = createSend(audioContext, reverb.input, 0.6);
  chainB.output.connect(sendB.input);
  createOnScreenKeyboard(keyboardBEl, synthB);

  renderParamPanel(paramsAEl, [
    {
      id: "filterAFreq",
      label: "Filter freq",
      min: 80,
      max: 12000,
      step: 10,
      value: 4000,
      onChange: (value) => filterA.setParams({ frequency: value }),
    },
    {
      id: "distortionAAmount",
      label: "Distortion amount",
      min: 0,
      max: 100,
      step: 1,
      value: 15,
      onChange: (value) => distortionA.setParams({ amount: value }),
    },
    {
      id: "sendA",
      label: "Reverb send",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.2,
      onChange: (value) => sendA.setLevel(value),
    },
  ]);

  renderParamPanel(paramsBEl, [
    {
      id: "filterBFreq",
      label: "Filter freq",
      min: 80,
      max: 12000,
      step: 10,
      value: 2000,
      onChange: (value) => filterB.setParams({ frequency: value }),
    },
    {
      id: "sendB",
      label: "Reverb send",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.6,
      onChange: (value) => sendB.setLevel(value),
    },
  ]);

  renderParamPanel(paramsReverbEl, [
    {
      id: "decay",
      label: "Decay (s)",
      min: 0.1,
      max: 8,
      step: 0.1,
      value: 2.5,
      onChange: (value) => reverb.setParams({ decaySeconds: value }),
    },
    {
      id: "damping",
      label: "Damping (Hz)",
      min: 500,
      max: 12000,
      step: 100,
      value: 6000,
      onChange: (value) => reverb.setParams({ dampingHz: value }),
    },
  ]);
});
