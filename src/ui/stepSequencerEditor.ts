// A clickable step grid for editing a StepSequencer pattern. Pairs with
// audio/../midi/stepSequencer.ts, which schedules a pattern shaped like
// this one onto a real NoteTarget — kept independent of it (no import from
// src/midi at all, same rule automationEditor.ts follows against
// audio/automation.ts) so this stays usable for anything shaped like a
// row of on/off/duration steps, not just StepSequencer specifically.

import { bindSlider, rangeControl } from "./sliderControl";

export interface EditableStep {
  on: boolean;
  /** 0-127, preserved but not exposed by this UI — set it via setSteps(). */
  velocity: number;
  /** 0-1, preserved but not exposed by this UI — set it via setSteps(). */
  gate: number;
  /** The rhythm control: this step's own length in seconds. */
  durationSeconds: number;
}

export interface StepSequencerEditorOptions {
  durationRange?: { min: number; max: number };
  onChange?: (steps: EditableStep[]) => void;
}

export interface StepSequencerEditorHandle {
  getSteps(): EditableStep[];
  setSteps(steps: EditableStep[]): void;
  /** Highlights the currently-audible step, e.g. driven by a consumer
   * polling StepSequencer.getCurrentStepIndex() on a requestAnimationFrame
   * loop. Pass null to clear the highlight. */
  setActiveStep(index: number | null): void;
}

const DEFAULT_DURATION_RANGE = { min: 0.05, max: 2 };

let instanceCounter = 0;

function defaultStep(durationSeconds: number): EditableStep {
  return { on: false, velocity: 100, gate: 0.8, durationSeconds };
}

export function createStepSequencerEditor(
  container: HTMLDivElement,
  initialSteps: EditableStep[],
  options: StepSequencerEditorOptions = {},
): StepSequencerEditorHandle {
  const durationRange = options.durationRange ?? DEFAULT_DURATION_RANGE;
  const instanceId = ++instanceCounter;

  let steps = initialSteps.map((step) => ({ ...step }));
  let cells: HTMLDivElement[] = [];
  let toggles: HTMLDivElement[] = [];
  let activeIndex: number | null = null;

  function emitChange(): void {
    options.onChange?.(steps.map((step) => ({ ...step })));
  }

  function updateToggle(index: number): void {
    toggles[index].classList.toggle(
      "step-sequencer-toggle-on",
      steps[index].on,
    );
  }

  // Structural rebuild (step count changed, or a whole new pattern was set
  // externally) — cheap enough here since there's no drag state to lose,
  // unlike automationEditor's handles.
  function render(): void {
    container.innerHTML = "";

    const countLabel = document.createElement("label");
    countLabel.className = "step-sequencer-count";
    countLabel.textContent = "Steps";
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "1";
    countInput.step = "1";
    countInput.value = String(steps.length);
    countInput.addEventListener("change", () => {
      resize(Math.max(1, Math.round(Number(countInput.value))));
    });
    countLabel.appendChild(countInput);
    container.appendChild(countLabel);

    const grid = document.createElement("div");
    grid.className = "step-sequencer-grid";
    grid.style.gridTemplateColumns = `repeat(${steps.length}, 1fr)`;
    container.appendChild(grid);

    cells = [];
    toggles = [];
    steps.forEach((step, index) => {
      const cell = document.createElement("div");
      cell.className = "step-sequencer-cell";

      const toggle = document.createElement("div");
      toggle.className = "step-sequencer-toggle";
      toggle.addEventListener("click", () => {
        steps[index].on = !steps[index].on;
        updateToggle(index);
        emitChange();
      });
      cell.appendChild(toggle);
      toggles.push(toggle);

      const durationId = `step-sequencer-${instanceId}-${index}-duration`;
      const durationWrapper = document.createElement("div");
      durationWrapper.className = "step-sequencer-duration";
      durationWrapper.innerHTML = rangeControl(
        durationId,
        "",
        durationRange.min,
        durationRange.max,
        0.01,
        step.durationSeconds,
      );
      cell.appendChild(durationWrapper);

      grid.appendChild(cell);
      cells.push(cell);
      updateToggle(index);

      bindSlider(durationId, (value) => {
        steps[index].durationSeconds = value;
        emitChange();
      });
    });

    if (activeIndex !== null) setActiveStep(activeIndex);
  }

  // Growing preserves the last step's duration as the fill value (a new
  // step blends in with the existing rhythm rather than defaulting to a
  // jarring fixed length); shrinking just truncates. Either way, every
  // step that already existed keeps its own data untouched.
  function resize(count: number): void {
    if (count === steps.length) return;
    if (count < steps.length) {
      steps = steps.slice(0, count);
    } else {
      const fillDuration =
        steps[steps.length - 1]?.durationSeconds ?? durationRange.min;
      while (steps.length < count) steps.push(defaultStep(fillDuration));
    }
    render();
    emitChange();
  }

  function setActiveStep(index: number | null): void {
    if (activeIndex !== null) {
      cells[activeIndex]?.classList.remove("step-sequencer-cell-active");
    }
    activeIndex = index;
    if (activeIndex !== null) {
      cells[activeIndex]?.classList.add("step-sequencer-cell-active");
    }
  }

  render();

  return {
    getSteps() {
      return steps.map((step) => ({ ...step }));
    },
    setSteps(newSteps: EditableStep[]) {
      steps = newSteps.map((step) => ({ ...step }));
      render();
    },
    setActiveStep,
  };
}
