// A rotary alternative to fields.ts's plain <input type="range"> --
// vertical pointer-drag to adjust (up increases, down decreases, same
// idiom as radio-tuner/src/knob.ts, though this one is DOM/CSS-based
// rather than canvas, to match how the rest of this module builds its
// elements), double-click to reset to a caller-given initial value, and
// a right-click menu for setting an exact value or editing this one
// knob's own min/max/scale directly -- since a param's "should this be
// logarithmic" default (see effectTable.ts's own taper) is necessarily a
// guess, and min/max defaults are necessarily just "a comfortable
// range." This module has no idea what a "hard bound" is or what a
// caller does with a bounds/scale change -- onBoundsChange/onScaleChange
// just report the edit; clamping and persistence are entirely the
// caller's own business (see effectsFields.ts's commitRange for the one
// caller that has real constraints to enforce).

export interface KnobOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Defaults to "linear". Silently treated as "linear" when min <= 0,
   * since a log curve has no meaning below/at zero. */
  scale?: "linear" | "log";
  /** Restored on double-click. Defaults to `value` (i.e. wherever this
   * knob started) if omitted. */
  initialValue?: number;
  onChange: (value: number) => void;
  onBoundsChange: (min: number, max: number) => void;
  onScaleChange: (scale: "linear" | "log") => void;
}

export interface KnobHandle {
  setValue(value: number): void;
}

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const DRAG_PIXELS_PER_SWEEP = 150;

function effectiveScale(
  scale: "linear" | "log" | undefined,
  min: number,
): "linear" | "log" {
  if (scale !== "log") return "linear";
  return min > 0 ? "log" : "linear";
}

function fractionToValue(
  fraction: number,
  min: number,
  max: number,
  scale: "linear" | "log",
): number {
  const f = Math.min(1, Math.max(0, fraction));
  if (scale === "log") return min * (max / min) ** f;
  return min + f * (max - min);
}

function valueToFraction(
  value: number,
  min: number,
  max: number,
  scale: "linear" | "log",
): number {
  if (scale === "log") return Math.log(value / min) / Math.log(max / min);
  return (value - min) / (max - min);
}

function snapToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

// Same decimals-from-step heuristic as fields.ts's own private
// formatValue -- small enough to duplicate rather than export across
// modules for.
function formatValue(value: number, step: number): string {
  const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
  return value.toFixed(decimals);
}

export function createKnob(
  container: HTMLElement,
  options: KnobOptions,
): KnobHandle {
  let { value, min, max } = options;
  const { step } = options;
  let scale = effectiveScale(options.scale, min);
  const initialValue = options.initialValue ?? value;

  container.classList.add("knob");

  const dial = document.createElement("div");
  dial.className = "knob-dial";
  dial.tabIndex = 0;
  const pointer = document.createElement("div");
  pointer.className = "knob-pointer";
  dial.appendChild(pointer);
  container.appendChild(dial);

  const valueEl = document.createElement("span");
  valueEl.className = "knob-value";
  container.appendChild(valueEl);

  function render(): void {
    const fraction = valueToFraction(value, min, max, scale);
    const angle = MIN_ANGLE + fraction * (MAX_ANGLE - MIN_ANGLE);
    pointer.style.transform = `rotate(${angle}deg)`;
    valueEl.textContent = formatValue(value, step);
  }

  function setValue(next: number): void {
    value = snapToStep(next, min, max, step);
    render();
  }

  render();

  let dragging = false;
  let startY = 0;
  let startFraction = 0;

  dial.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    startY = event.clientY;
    startFraction = valueToFraction(value, min, max, scale);
    dial.setPointerCapture(event.pointerId);
  });
  dial.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaFraction = (startY - event.clientY) / DRAG_PIXELS_PER_SWEEP;
    const nextValue = snapToStep(
      fractionToValue(startFraction + deltaFraction, min, max, scale),
      min,
      max,
      step,
    );
    if (nextValue === value) return;
    value = nextValue;
    render();
    options.onChange(value);
  });
  dial.addEventListener("pointerup", () => {
    dragging = false;
  });
  dial.addEventListener("dblclick", () => {
    setValue(initialValue);
    options.onChange(value);
  });

  dial.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMenu();
  });

  function openMenu(): void {
    const overlay = document.createElement("div");
    overlay.className = "knob-menu-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    const menu = document.createElement("div");
    menu.className = "knob-menu";
    overlay.appendChild(menu);

    function close(): void {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
    }
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeydown);

    const header = document.createElement("div");
    header.className = "knob-menu-header";
    const title = document.createElement("span");
    title.textContent = "Knob settings";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "knob-menu-close";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", close);
    header.append(title, closeButton);
    menu.appendChild(header);

    const body = document.createElement("div");
    body.className = "knob-menu-body";
    menu.appendChild(body);

    function field(labelText: string, input: HTMLElement): void {
      const row = document.createElement("label");
      row.className = "knob-menu-row";
      const label = document.createElement("span");
      label.textContent = labelText;
      row.append(label, input);
      body.appendChild(row);
    }

    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.step = String(step);
    valueInput.value = String(value);
    field("Value", valueInput);

    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.value = String(min);
    field("Min", minInput);

    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.value = String(max);
    field("Max", maxInput);

    const scaleSelect = document.createElement("select");
    for (const option of ["linear", "log"] as const) {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option === "linear" ? "Linear" : "Logarithmic";
      optionEl.selected = option === scale;
      optionEl.disabled = option === "log" && Number(minInput.value) <= 0;
      scaleSelect.appendChild(optionEl);
    }
    field("Scale", scaleSelect);

    const footer = document.createElement("div");
    footer.className = "knob-menu-footer";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "Apply";
    applyButton.addEventListener("click", () => {
      const nextMin = Number(minInput.value);
      const nextMax = Number(maxInput.value);
      const nextScale = scaleSelect.value as "linear" | "log";
      const nextValue = Number(valueInput.value);
      if (
        Number.isFinite(nextMin) &&
        Number.isFinite(nextMax) &&
        nextMin < nextMax
      ) {
        if (nextMin !== min || nextMax !== max) {
          options.onBoundsChange(nextMin, nextMax);
        }
        min = nextMin;
        max = nextMax;
      }
      if (nextScale !== scale) {
        scale = effectiveScale(nextScale, min);
        options.onScaleChange(nextScale);
      }
      if (Number.isFinite(nextValue) && nextValue !== value) {
        setValue(nextValue);
        options.onChange(value);
      } else {
        render();
      }
      close();
    });
    footer.appendChild(applyButton);
    menu.appendChild(footer);

    document.body.appendChild(overlay);
    valueInput.focus();
  }

  return { setValue };
}
