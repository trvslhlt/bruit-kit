// Small vanilla-DOM control-panel helpers — labeled range slider with a
// live value readout, pairs with sliderControl.css for styling.

import { openRangeMenu } from "./rangeMenu";

/** HTML for a labeled range input with min/max hints and a live value
 * readout — insert into a template string, then call bindSlider(id, ...)
 * once the markup is in the DOM. */
export function rangeControl(
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
): string {
  return `
    <label>
      <span class="control-name">${label}</span>
      <span class="range-min" id="${id}-min">${min}</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="range-max" id="${id}-max">${max}</span>
      <span class="range-value" id="${id}-value">${value}</span>
    </label>
  `;
}

export function formatSliderValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface SliderMenuOptions {
  /** Domain limits a right-click range edit can't push past, e.g. a 0..1
   * gain/mix control. Omit for a control with no fixed domain. */
  hardMin?: number;
  hardMax?: number;
}

/** Wires up a rangeControl()'s <input>, updating its live value readout and
 * calling `onChange` on every input event — including once immediately, so
 * whatever onChange does (e.g. apply the value to an AudioParam) happens
 * right away rather than waiting for the first user interaction. Also wires
 * a right-click "Value / Min / Max" menu (see rangeMenu.ts) onto every
 * slider unconditionally — unlike fields.ts's equivalent, there's no
 * opt-in flag here, since every one of this helper's ~35 call sites would
 * need touching to opt in anyway, so an opt-out costs nothing extra. */
export function bindSlider(
  id: string,
  onChange: (value: number) => void,
  options?: SliderMenuOptions,
): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
  const valueDisplay = document.querySelector<HTMLSpanElement>(`#${id}-value`);
  const minDisplay = document.querySelector<HTMLSpanElement>(`#${id}-min`);
  const maxDisplay = document.querySelector<HTMLSpanElement>(`#${id}-max`);
  const apply = () => {
    const value = Number(input.value);
    if (valueDisplay) valueDisplay.textContent = formatSliderValue(value);
    onChange(value);
  };
  input.addEventListener("input", apply);
  apply();

  const hardMin = options?.hardMin ?? Number.NEGATIVE_INFINITY;
  const hardMax = options?.hardMax ?? Number.POSITIVE_INFINITY;

  input.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openRangeMenu({
      value: Number(input.value),
      min: Number(input.min),
      max: Number(input.max),
      step: Number(input.step),
      onSetValue: (v) => {
        const clamped = Math.min(
          Math.max(v, Number(input.min)),
          Number(input.max),
        );
        input.value = String(clamped);
        apply();
      },
      // openRangeMenu already guarantees nextMin < nextMax before calling
      // this, but clamping each independently into the hard bound can
      // still collapse them to the same edge (e.g. both requested values
      // fall above a narrow hardMax) -- bail rather than leave a
      // zero-width slider in that case.
      onBoundsChange: (nextMin, nextMax) => {
        const clampedMin = Math.min(Math.max(nextMin, hardMin), hardMax);
        const clampedMax = Math.min(Math.max(nextMax, hardMin), hardMax);
        const finalMin = Math.min(clampedMin, clampedMax);
        const finalMax = Math.max(clampedMin, clampedMax);
        if (finalMin === finalMax) return;

        input.min = String(finalMin);
        input.max = String(finalMax);
        if (minDisplay) minDisplay.textContent = formatSliderValue(finalMin);
        if (maxDisplay) maxDisplay.textContent = formatSliderValue(finalMax);

        const currentValue = Number(input.value);
        const clampedValue = Math.min(
          Math.max(currentValue, finalMin),
          finalMax,
        );
        if (clampedValue !== currentValue) {
          input.value = String(clampedValue);
          apply();
        }
      },
    });
  });
}
