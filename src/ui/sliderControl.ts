// Small vanilla-DOM control-panel helpers — labeled range slider with a
// live value readout, pairs with sliderControl.css for styling.

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
      <span class="range-min">${min}</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="range-max">${max}</span>
      <span class="range-value" id="${id}-value">${value}</span>
    </label>
  `;
}

export function formatSliderValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Wires up a rangeControl()'s <input>, updating its live value readout and
 * calling `onChange` on every input event — including once immediately, so
 * whatever onChange does (e.g. apply the value to an AudioParam) happens
 * right away rather than waiting for the first user interaction. */
export function bindSlider(
  id: string,
  onChange: (value: number) => void,
): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
  const valueDisplay = document.querySelector<HTMLSpanElement>(`#${id}-value`);
  const apply = () => {
    const value = Number(input.value);
    if (valueDisplay) valueDisplay.textContent = formatSliderValue(value);
    onChange(value);
  };
  input.addEventListener("input", apply);
  apply();
}
