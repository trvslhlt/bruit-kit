import { createStepClock } from "../src/midi/stepClock";
import { type TrackStep, createStepTrack } from "../src/midi/stepTrack";
import { NoiseGenerator } from "../src/sources/noiseGenerator";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const playButtonEl = document.querySelector<HTMLButtonElement>("#play-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;
const muteAEl = document.querySelector<HTMLInputElement>("#mute-a")!;
const muteBEl = document.querySelector<HTMLInputElement>("#mute-b")!;
const rowAEl = document.querySelector<HTMLDivElement>("#row-a")!;
const rowBEl = document.querySelector<HTMLDivElement>("#row-b")!;
const enableRowBButtonEl = document.querySelector<HTMLButtonElement>(
  "#enable-row-b-button",
)!;
const rowBStatusEl = document.querySelector<HTMLSpanElement>("#row-b-status")!;

const STEP_COUNT = 8;
const NOTE_A = 48;
const NOTE_B = 1; // NoiseGenerator ignores pitch; any value works as the voice key

function renderRowGrid(
  container: HTMLElement,
  steps: boolean[],
  onToggle: (index: number) => void,
): HTMLDivElement[] {
  container.innerHTML = "";
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "4px";
  row.style.margin = "0.5rem 0 1rem";
  const cells = steps.map((on, i) => {
    const cell = document.createElement("div");
    cell.textContent = String(i + 1);
    cell.style.width = "36px";
    cell.style.height = "36px";
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    cell.style.cursor = "pointer";
    cell.style.borderRadius = "4px";
    cell.style.background = on ? "#4c7dff" : "#2a2d34";
    cell.style.color = "#e4e6eb";
    cell.style.border = "1px solid #3a3e47";
    cell.addEventListener("click", () => onToggle(i));
    row.appendChild(cell);
    return cell;
  });
  container.appendChild(row);
  return cells;
}

unlockAudioContext(unlockEl).then((audioContext) => {
  const synthA = new OscillatorSynth(audioContext);
  connectToOutput(synthA.output, audioContext);
  const noiseB = new NoiseGenerator(audioContext);
  noiseB.setParams({ type: "white" });
  connectToOutput(noiseB.output, audioContext);

  let stepSeconds = 0.25;
  const clock = createStepClock(audioContext, () => stepSeconds);

  const onA = [true, false, true, false, true, false, true, false];
  const onB = [false, true, false, true, false, false, true, false];
  let muteA = false;
  let muteB = false;
  let rowBActive = false;
  let rowBPending = false;

  // Watches for the next cycle start to activate a pending row -- no
  // special support from the clock itself, purely app-level state built
  // on the same tick stream every row already subscribes to.
  clock.onTick((stepIndex) => {
    if (rowBPending && stepIndex % STEP_COUNT === 0) {
      rowBPending = false;
      rowBActive = true;
      rowBStatusEl.textContent = "";
    }
  });

  function trackSteps(
    on: boolean[],
    note: number,
    muted: boolean,
    active: boolean,
  ): TrackStep[] {
    return on.map((isOn) => ({
      notes: isOn && !muted && active ? [note] : [],
      velocity: 100,
      gate: 0.6,
    }));
  }

  createStepTrack(synthA, clock, () => trackSteps(onA, NOTE_A, muteA, true));
  createStepTrack(noiseB, clock, () =>
    trackSteps(onB, NOTE_B, muteB, rowBActive),
  );

  const cellsA = renderRowGrid(rowAEl, onA, (i) => {
    onA[i] = !onA[i];
    cellsA[i].style.background = onA[i] ? "#4c7dff" : "#2a2d34";
  });
  const cellsB = renderRowGrid(rowBEl, onB, (i) => {
    onB[i] = !onB[i];
    cellsB[i].style.background = onB[i] ? "#4c7dff" : "#2a2d34";
  });

  muteAEl.addEventListener("change", () => {
    muteA = muteAEl.checked;
  });
  muteBEl.addEventListener("change", () => {
    muteB = muteBEl.checked;
  });

  enableRowBButtonEl.addEventListener("click", () => {
    if (rowBActive || rowBPending) return;
    rowBPending = true;
    rowBStatusEl.textContent = "pending — joins at next cycle start";
  });

  playButtonEl.addEventListener("click", () => clock.start());
  stopButtonEl.addEventListener("click", () => clock.stop());

  renderParamPanel(paramsEl, [
    {
      id: "stepSeconds",
      label: "Step length (s)",
      min: 0.05,
      max: 1,
      step: 0.01,
      value: stepSeconds,
      onChange: (value) => {
        stepSeconds = value;
      },
    },
  ]);

  function tick(): void {
    // getCurrentStepIndex() is the clock's own raw, ever-incrementing tick
    // count -- it has no idea any row is 8 cells wide, that's
    // createStepTrack's own internal wrapping. Wrap it the same way here
    // for the playhead highlight, or it climbs past the last cell after
    // one cycle and never lights anything again.
    const rawActive = clock.getCurrentStepIndex();
    const active = rawActive === null ? null : rawActive % STEP_COUNT;
    for (const cells of [cellsA, cellsB]) {
      cells.forEach((cell, i) => {
        cell.style.boxShadow = i === active ? "0 0 0 2px #ffb454" : "none";
      });
    }
    requestAnimationFrame(tick);
  }
  tick();
});
