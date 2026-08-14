import { PhaseDistortionSynth } from "../src/sources/phaseDistortionSynth";
import type { AutomationPoint } from "../src/ui/automationEditor";
import { createAutomationEditor } from "../src/ui/automationEditor";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const editorEl = document.querySelector<HTMLDivElement>("#editor")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

// A saw-ish default warp: phase races ahead early in the cycle then
// crawls through the rest, the classic CZ "saw" DCW shape.
const initialPoints: AutomationPoint[] = [
  { position: 0, value: 0 },
  { position: 0.15, value: 0.8 },
  { position: 1, value: 1 },
];

unlockAudioContext(unlockEl).then(async (audioContext) => {
  const synth = new PhaseDistortionSynth(audioContext);
  await synth.init();
  wireSourceDemo(audioContext, keyboardEl, synth);

  const editor = createAutomationEditor(editorEl, initialPoints, {
    width: 560,
    height: 140,
    onChange: (points) => synth.setDistortionCurve(points),
  });
  synth.setDistortionCurve(editor.getPoints());

  renderParamPanel(paramsEl, [
    {
      id: "distortionAmount",
      label: "Distortion amount",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => synth.setParams({ distortionAmount: value }),
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
