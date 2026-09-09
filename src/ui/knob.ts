// A rotary alternative to fields.ts's plain <input type="range"> --
// vertical pointer-drag to adjust (up increases, down decreases, same
// idiom as radio-tuner/src/knob.ts, though this one is DOM/CSS-based
// rather than canvas, to match how the rest of this module builds its
// elements), double-click to reset to a caller-given initial value, and
// a right-click menu (see rangeMenu.ts, shared with fields.ts's own
// slider rendering) for setting an exact value or editing this one
// knob's own min/max/scale directly -- since a param's "should this be
// logarithmic" default (see effectTable.ts's own taper) is necessarily a
// guess, and min/max defaults are necessarily just "a comfortable
// range."

import {
  type RangeScale,
  effectiveScale,
  formatRangeValue,
  fractionToValue,
  snapToStep,
  valueToFraction,
} from "./rangeMath";
import { openRangeMenu } from "./rangeMenu";

export interface KnobOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Defaults to "linear". Silently treated as "linear" when min <= 0,
   * since a log curve has no meaning below/at zero. */
  scale?: RangeScale;
  /** Restored on double-click. Defaults to `value` (i.e. wherever this
   * knob started) if omitted. */
  initialValue?: number;
  onChange: (value: number) => void;
  onBoundsChange: (min: number, max: number) => void;
  onScaleChange: (scale: RangeScale) => void;
}

export interface KnobHandle {
  setValue(value: number): void;
}

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const DRAG_PIXELS_PER_SWEEP = 150;

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
    valueEl.textContent = formatRangeValue(value, step);
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
    openRangeMenu({
      value,
      min,
      max,
      step,
      scale,
      onSetValue: (v) => {
        setValue(v);
        options.onChange(value);
      },
      onBoundsChange: (nextMin, nextMax) => {
        min = nextMin;
        max = nextMax;
        render();
        options.onBoundsChange(nextMin, nextMax);
      },
      onScaleChange: (nextScale) => {
        scale = effectiveScale(nextScale, min);
        render();
        options.onScaleChange(nextScale);
      },
    });
  });

  return { setValue };
}
