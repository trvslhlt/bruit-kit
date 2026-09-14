// The right-click "Value / Min / Max / Scale" settings menu shared by
// every range-shaped control in this module (knob.ts's dial, and
// fields.ts's own <input type="range"> once it opts in) -- one popup
// implementation rather than two copies that would drift. This module
// has no idea what a "hard bound" is or what a caller does with a
// bounds/scale change -- onBoundsChange/onScaleChange just report the
// edit; clamping and persistence are entirely the caller's own business
// (see effectsFields.ts's commitRange for the one caller that has real
// constraints to enforce).

import type { RangeScale } from "./rangeMath";

export interface RangeMenuOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Omit (along with onScaleChange) for a control with no log-scale
   * concept, e.g. a plain sliderControl.ts slider -- the Scale row is left
   * out of the menu entirely rather than shown with nothing meaningful to
   * do. */
  scale?: RangeScale;
  /** Called when the menu's own Value field is applied -- a live update,
   * same as a drag tick: the caller should reflect it immediately but
   * doesn't need to (and, mid-drag-gesture callers aside, generally
   * shouldn't) trigger a full rebuild for it. */
  onSetValue: (value: number) => void;
  onBoundsChange: (min: number, max: number) => void;
  onScaleChange?: (scale: RangeScale) => void;
}

/** Appended straight to document.body as a small centered overlay --
 * self-styled (see knob.css's own .knob-menu* rules, shared by this
 * module too rather than duplicated under a second class prefix), not
 * anchored to the control that opened it, so it isn't lost if that
 * control's own row gets rebuilt out from under it by a bounds/scale
 * commit (see fields.ts's own top-of-file doc on why continuous
 * controls avoid triggering rebuilds from a live "input" event, but a
 * committing one like this menu's Apply button is exactly the case
 * that's expected to). */
// At most one of these menus is ever open at once -- opening a second
// closes whatever the first was editing, the same as a native OS popup.
// The overlay's own fixed, full-viewport backdrop (knob.css) normally
// makes a second one unreachable anyway (nothing behind it can receive
// the right-click that would open one), but a caller whose page hasn't
// loaded that CSS -- easy to miss, see demo.css's own comment on this --
// would otherwise silently stack plain, unstyled menus instead.
let closeActiveMenu: (() => void) | null = null;

export function openRangeMenu(options: RangeMenuOptions): void {
  closeActiveMenu?.();

  const { value, min, max, step, scale } = options;

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
    if (closeActiveMenu === close) closeActiveMenu = null;
  }
  closeActiveMenu = close;
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);

  const header = document.createElement("div");
  header.className = "knob-menu-header";
  const title = document.createElement("span");
  title.textContent = "Settings";
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
  if (scale !== undefined) {
    for (const option of ["linear", "log"] as const) {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option === "linear" ? "Linear" : "Logarithmic";
      optionEl.selected = option === scale;
      optionEl.disabled = option === "log" && Number(minInput.value) <= 0;
      scaleSelect.appendChild(optionEl);
    }
    field("Scale", scaleSelect);
  }

  const footer = document.createElement("div");
  footer.className = "knob-menu-footer";
  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "Apply";
  applyButton.addEventListener("click", () => {
    const nextMin = Number(minInput.value);
    const nextMax = Number(maxInput.value);
    const nextValue = Number(valueInput.value);

    if (
      Number.isFinite(nextMin) &&
      Number.isFinite(nextMax) &&
      nextMin < nextMax &&
      (nextMin !== min || nextMax !== max)
    ) {
      options.onBoundsChange(nextMin, nextMax);
    }
    if (scale !== undefined && options.onScaleChange) {
      const nextScale = scaleSelect.value as RangeScale;
      if (nextScale !== scale) {
        options.onScaleChange(nextScale);
      }
    }
    if (Number.isFinite(nextValue) && nextValue !== value) {
      options.onSetValue(nextValue);
    }
    close();
  });
  footer.appendChild(applyButton);
  menu.appendChild(footer);

  document.body.appendChild(overlay);
  valueInput.focus();
}
