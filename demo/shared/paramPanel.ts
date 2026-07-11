import { bindSlider, rangeControl } from "../../src/ui/sliderControl";

export interface ParamSpec {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

let panelCounter = 0;

/** Renders a column of rangeControl/bindSlider sliders from a plain spec
 * list — the one part of every param-panel demo that's identical across
 * effects/sources, so it's written once instead of a dozen times.
 * Non-numeric params (waveform selects, checkboxes) aren't generalized
 * here — see renderSelect below, or just a few lines of native DOM in the
 * one or two demos that need one. */
export function renderParamPanel(
  container: HTMLElement,
  params: ParamSpec[],
): void {
  const instanceId = ++panelCounter;
  container.innerHTML = params
    .map((p) =>
      rangeControl(
        `param-${instanceId}-${p.id}`,
        p.label,
        p.min,
        p.max,
        p.step,
        p.value,
      ),
    )
    .join("");
  for (const p of params) {
    bindSlider(`param-${instanceId}-${p.id}`, p.onChange);
  }
}

/** A labeled <select>, styled to match rangeControl's <label> row, for the
 * handful of demo params that are a fixed set of options (waveform type,
 * filter type) rather than a numeric range. */
export function renderSelect<T extends string>(
  container: HTMLElement,
  label: string,
  options: readonly T[],
  value: T,
  onChange: (value: T) => void,
): void {
  const wrapper = document.createElement("label");
  const name = document.createElement("span");
  name.className = "control-name";
  name.textContent = label;
  wrapper.appendChild(name);

  const select = document.createElement("select");
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    el.selected = option === value;
    select.appendChild(el);
  }
  select.addEventListener("change", () => onChange(select.value as T));
  wrapper.appendChild(select);

  container.appendChild(wrapper);
}
