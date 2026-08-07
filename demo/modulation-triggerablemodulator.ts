import { scheduleAutomation } from "../src/audio/automation";
import { FilterEffect } from "../src/audio/filterEffect";
import { createTriggerableModulator } from "../src/audio/modulation/triggerableModulator";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const triggerButtonEl =
  document.querySelector<HTMLButtonElement>("#trigger-button")!;

const BASE_FREQUENCY = 1500;

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  const filter = new FilterEffect(audioContext);
  filter.setParams({
    wet: 1,
    type: "lowpass",
    frequency: BASE_FREQUENCY,
    q: 6,
  });
  synth.output.connect(filter.input);
  connectToOutput(filter.output, audioContext);
  createOnScreenKeyboard(keyboardEl, synth);

  // Continuously modulates the filter's own frequency -- additive on top of
  // its base 1500Hz, same as lfoEngine.ts's native-AudioParam wiring, just
  // owned by this one modulator instance instead of a slot engine.
  const modulator = createTriggerableModulator(audioContext, "sine");
  modulator.connect(filter.frequencyParam);

  // "Trigger": the brief's own example -- an LFO whose *rate* sweeps
  // 1Hz -> 20Hz over 2 seconds on every press, while its depth swells then
  // settles, both scheduled with the exact same scheduleAutomation used
  // for relpmas's modulation routes (this demo doesn't have per-node
  // triggers to hang it off, just a button).
  triggerButtonEl.addEventListener("click", () => {
    const now = audioContext.currentTime;
    scheduleAutomation(
      modulator.rateParam,
      [
        { position: 0, value: 0 },
        { position: 1, value: 1 },
      ],
      audioContext,
      2,
      { min: 1, max: 20 },
      now,
    );
    scheduleAutomation(
      modulator.depthParam,
      [
        { position: 0, value: 0 },
        { position: 0.3, value: 1 },
        { position: 1, value: 0.25 },
      ],
      audioContext,
      2,
      { min: 0, max: 1200 },
      now,
    );
  });
});
