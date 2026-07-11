import {
  type AutomationLoopHandle,
  startAutomationLoop,
} from "../src/audio/automation";
import { FilterEffect } from "../src/audio/filterEffect";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import {
  type AutomationPoint,
  createAutomationEditor,
} from "../src/ui/automationEditor";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const noteToggleEl = document.querySelector<HTMLInputElement>("#note-toggle")!;
const editorEl = document.querySelector<HTMLDivElement>("#editor")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;
const loopButtonEl = document.querySelector<HTMLButtonElement>("#loop-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;

const NOTE = 57;

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  const filter = new FilterEffect(audioContext);
  filter.setParams({ wet: 1, type: "lowpass", q: 4 });
  synth.output.connect(filter.input);
  connectToOutput(filter.output, audioContext);

  noteToggleEl.addEventListener("change", () => {
    if (noteToggleEl.checked) synth.noteOn(NOTE, 90);
    else synth.noteOff(NOTE);
  });

  const initialPoints: AutomationPoint[] = [
    { position: 0, value: 0.1 },
    { position: 0.5, value: 0.9 },
    { position: 1, value: 0.1 },
  ];
  const editor = createAutomationEditor(editorEl, initialPoints, {
    width: 560,
    height: 140,
  });

  let durationSeconds = 3;
  let loopHandle: AutomationLoopHandle | null = null;

  renderParamPanel(paramsEl, [
    {
      id: "duration",
      label: "Duration (s)",
      min: 0.5,
      max: 10,
      step: 0.1,
      value: durationSeconds,
      onChange: (value) => {
        durationSeconds = value;
      },
    },
  ]);

  loopButtonEl.addEventListener("click", () => {
    loopHandle?.stop();
    loopHandle = startAutomationLoop(
      filter.frequencyParam,
      audioContext,
      () => editor.getPoints(),
      () => durationSeconds,
      { min: 200, max: 8000 },
    );
  });
  stopButtonEl.addEventListener("click", () => {
    loopHandle?.stop();
    loopHandle = null;
  });
});
