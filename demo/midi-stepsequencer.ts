import { type SequencerStep, StepSequencer } from "../src/midi/stepSequencer";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import {
  type EditableStep,
  createStepSequencerEditor,
} from "../src/ui/stepSequencerEditor";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const playButtonEl = document.querySelector<HTMLButtonElement>("#play-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;
const editorEl = document.querySelector<HTMLDivElement>("#editor")!;

const NOTE = 60;
const INITIAL_ON = [true, false, true, false, true, true, false, true];
const INITIAL_DURATIONS = [0.3, 0.3, 0.45, 0.3, 0.3, 0.3, 0.45, 0.3];

function toSequencerSteps(steps: EditableStep[]): SequencerStep[] {
  return steps.map((step) => ({
    notes: step.on ? [NOTE] : [],
    velocity: step.velocity,
    gate: step.gate,
    durationSeconds: step.durationSeconds,
  }));
}

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  connectToOutput(synth.output, audioContext);

  const sequencer = new StepSequencer(synth);

  const initialSteps: EditableStep[] = INITIAL_ON.map((on, i) => ({
    on,
    velocity: 100,
    gate: 0.8,
    durationSeconds: INITIAL_DURATIONS[i],
  }));
  sequencer.setSteps(toSequencerSteps(initialSteps));

  const editor = createStepSequencerEditor(editorEl, initialSteps, {
    onChange: (steps) => sequencer.setSteps(toSequencerSteps(steps)),
  });

  playButtonEl.addEventListener("click", () => sequencer.start());
  stopButtonEl.addEventListener("click", () => sequencer.stop());

  function tick(): void {
    editor.setActiveStep(sequencer.getCurrentStepIndex());
    requestAnimationFrame(tick);
  }
  tick();
});
