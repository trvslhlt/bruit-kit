/** A chain is a plain, ordered EffectSpec[] list -- each entry renders as
 * its own removable block in the panel this builds (a "Remove" button
 * doubling as that instance's own heading), followed by "+ Add effect" and,
 * once there's anything to save, "Save chain as preset...". Built on
 * effectTable.ts's EFFECT_TABLE (every param, its slider range, and the
 * absolute bound a per-instance custom range can't exceed) plus fields.ts's
 * generic Field renderer -- this module is the UI layer over both, with no
 * dependency on any particular app's own rows/cells/patches concepts,
 * beyond the plain EffectSpec[] it's handed. */

import type { EffectSpec, EffectType } from "../audio/effectSpec";
import { EFFECT_TABLE, activeRangeFor, hardBoundFor } from "./effectTable";
import { type Field, renderFields } from "./fields";

// Shared across every effectsFields call (row/cell/master alike) rather
// than scoped per-chain -- effectsFields is a plain module-level function
// called fresh from 3 different places, with no closure of its own that
// would survive across renders the way rowPanel's per-row Maps used to.
// A single "what to add next" pick leaking between panels is a harmless
// cosmetic quirk (a freshly-opened panel might show the last-picked type
// pre-selected instead of the first one) worth accepting for how much
// simpler it keeps this over threading a unique key through every caller.
let pendingEffectType: EffectType = EFFECT_TABLE[0].type;

/** A small popup (min/max for exactly one param) opened by clicking that
 * param's own label -- see fields.ts's onLabelClick/labelCustomized on
 * the "range" field kind. Appended straight to document.body, outside
 * whatever panel container the caller re-renders on every edit (see
 * effectsFields' own doc on why every handler re-reads getEffects()
 * fresh): a commit here triggers that outer re-render same as any other
 * effectsFields edit, but this popup's own DOM isn't part of that
 * container, so it needs its own local re-render (renderBody) to reflect
 * the just-committed, possibly-hard-bound-clamped values instead of just
 * whatever was last typed. */
function openParamRangeModal(
  label: string,
  getActive: () => { min: number; max: number },
  hard: { min: number; max: number },
  step: number,
  onCommit: (min: number, max: number) => void,
  onReset: () => void,
  // Only present for a param that has a persistent chain to nudge live
  // (row/master/send-bus, not a per-cell override -- see effectsFields'
  // own enableDrift doc). Drift wanders within whatever range this same
  // modal edits, so it lives in this popup rather than a separate control.
  // Speed is per-param (see EffectSpec.drift's own doc on why), shown
  // only while Drift itself is checked -- meaningless otherwise, and
  // this is a self-contained popup rather than the main panel, so a
  // field that appears/disappears with a sibling checkbox here doesn't
  // run into the "never conditionally hide a field" rule that applies to
  // the always-visible panel body.
  drift?: {
    enabled: () => boolean;
    onToggle: (enabled: boolean) => void;
    speed: () => number;
    onSpeedChange: (speed: number) => void;
  },
): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal param-range-modal";
  overlay.appendChild(modal);

  function close(): void {
    overlay.remove();
  }
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("span");
  title.className = "modal-title";
  title.textContent = `${label} — range`;
  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.className = "modal-close-button";
  closeButton.addEventListener("click", close);
  header.append(title, closeButton);
  modal.appendChild(header);

  const body = document.createElement("div");
  body.className = "modal-body";
  modal.appendChild(body);

  function renderBody(): void {
    const active = getActive();
    renderFields(body, [
      {
        key: "range-min",
        label: "Min",
        kind: "number",
        value: active.min,
        min: hard.min,
        max: hard.max,
        step,
        onChange: (v) => {
          onCommit(v, getActive().max);
          renderBody();
        },
      },
      {
        key: "range-max",
        label: "Max",
        kind: "number",
        value: active.max,
        min: hard.min,
        max: hard.max,
        step,
        onChange: (v) => {
          onCommit(getActive().min, v);
          renderBody();
        },
      },
      ...(drift
        ? [
            {
              key: "drift-enabled",
              label: "Drift within this range",
              kind: "checkbox" as const,
              value: drift.enabled(),
              onChange: (v: boolean) => {
                drift.onToggle(v);
                renderBody();
              },
            },
            ...(drift.enabled()
              ? [
                  {
                    key: "drift-speed",
                    label: "Speed",
                    kind: "range" as const,
                    value: drift.speed(),
                    min: 0,
                    max: 1,
                    step: 0.01,
                    onChange: (v: number) => drift.onSpeedChange(v),
                  },
                ]
              : []),
          ]
        : []),
    ]);
  }
  renderBody();

  const footer = document.createElement("div");
  footer.className = "modal-footer";
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset to default";
  resetButton.addEventListener("click", () => {
    onReset();
    renderBody();
  });
  footer.appendChild(resetButton);
  modal.appendChild(footer);

  document.body.appendChild(overlay);
}

/** A chain is a plain ordered list now, not six fixed on/off slots: each
 * entry already in `getEffects()` renders as its own removable block (a
 * "Remove" button doubling as that instance's own heading, same
 * "no separate label needed" reasoning the old checkbox-as-heading had),
 * followed by "+ Add effect" (append a fresh default instance of the
 * chosen type -- nothing stops the same type being added twice, unlike
 * before) and, once there's anything to save, "Save chain as preset...".
 *
 * `getEffects` is called fresh inside every handler, not just once up
 * front: none of this panel's continuous controls trigger a rebuild on
 * their own "input" events (see fields.ts's top comment for why), so a
 * remove followed by a value drag with no render in between would
 * otherwise have the value handler still closing over the pre-removal
 * array and silently undoing the removal when it fires. */
export function effectsFields(
  getEffects: () => EffectSpec[],
  onUpdate: (next: EffectSpec[]) => void,
  // Fires on every "input" tick of a param's own range slider (or a
  // select's single "change") -- i.e. a value-only edit that never adds,
  // removes, or reorders an effect and never touches a field's own
  // label (paramRanges/drift), so it needs no rebuild to stay correct
  // (see fields.ts's top comment). Falls back to onUpdate when omitted,
  // but every current caller supplies a rebuild-free version -- routing
  // a continuous drag through onUpdate instead tears this exact <input>
  // out of the DOM on the first tick (onUpdate's callers all rebuild
  // their container), aborting the drag gesture after one step.
  onLiveUpdate: (next: EffectSpec[]) => void = onUpdate,
  onSaveAsPreset?: (effects: EffectSpec[], name: string) => void,
  // Only set by callers backed by one of the three persistent chains
  // (whatever a caller's own persistent chains are). Omitted for a
  // cell's own effects override, which has no persistent chain to nudge
  // (a fresh one-shot instance per hit), so no Drift control is offered
  // there. Deliberately just a boolean, not the caller's own target
  // identity -- this module never needs to know *which* chain it's
  // editing, only whether wandering makes sense for it at all.
  enableDrift?: boolean,
): Field[] {
  const effects = getEffects();
  const fields: Field[] = [];

  // Swaps effect `from` with whichever neighbor is at `to`, a no-op past
  // either end of the chain -- shared by every instance's ▲/▼ buttons
  // below rather than redefined per iteration.
  function moveEffect(from: number, to: number): void {
    const current = getEffects();
    if (to < 0 || to >= current.length) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onUpdate(next);
  }

  effects.forEach((spec, index) => {
    const table = EFFECT_TABLE.find((e) => e.type === spec.type);
    if (!table) return;
    // ▲/▼ reorder this instance within the chain (disabled at either
    // end), "Remove" deletes it -- doubles as this instance's own
    // heading (table.label as the row's label) the same way the old
    // lone "Remove" button used to, just with two more compact controls
    // alongside it instead of a second full-width button each.
    fields.push({
      key: `${index}-header`,
      label: table.label,
      kind: "buttonRow",
      buttons: [
        {
          label: "▲",
          disabled: index === 0,
          onClick: () => moveEffect(index, index - 1),
        },
        {
          label: "▼",
          disabled: index === effects.length - 1,
          onClick: () => moveEffect(index, index + 1),
        },
        {
          label: "Remove",
          onClick: () => {
            const current = getEffects();
            onUpdate(current.filter((_, i) => i !== index));
          },
        },
      ],
    });
    for (const param of table.params) {
      // No "Effect: " prefix -- the Remove button above already reads as
      // this instance's own heading (see table.label there), so repeating
      // the effect's name on every param below it is redundant. Right-
      // aligning the row (see fields.ts's `indented`) is what gives the
      // group its visual separation from the heading instead.
      const key = `${index}-${param.key}`;
      const stored = spec.params[param.key];
      const onChange = (v: number | string) => {
        const current = getEffects();
        onLiveUpdate(
          current.map((e, i) =>
            i === index ? { ...e, params: { ...e.params, [param.key]: v } } : e,
          ),
        );
      };
      if (param.kind === "select") {
        fields.push({
          key,
          label: param.label,
          kind: "select",
          value: typeof stored === "string" ? stored : param.default,
          options: param.options,
          indented: true,
          onChange,
        });
      } else {
        // min/max/step are already authored in display units (e.g.
        // compressor attack's 0..200 ms) -- only `default`/`stored` are in
        // the effect class's own native units (seconds), so scale applies
        // to the value conversion alone, not the range bounds. The
        // slider's own min/max come from activeRangeFor, not the table's
        // param.min/max directly, so a per-instance custom range (set via
        // this same field's own clickable label, see below) actually
        // takes effect on the control itself.
        const scale = param.scale ?? 1;
        const storedNumber =
          typeof stored === "number" ? stored : param.default;
        const active = activeRangeFor(spec, param);
        const hard = hardBoundFor(param);

        // Shared by the label-click popup's two number inputs (see
        // openParamRangeModal) -- clamps both to this param's hard
        // bound, then clamps the currently-stored value into whatever
        // range results so a widened-then-narrowed range can't leave the
        // slider showing a value outside its own min/max.
        const commitRange = (nextMin: number, nextMax: number): void => {
          const clampedMin = Math.min(Math.max(nextMin, hard.min), hard.max);
          const clampedMax = Math.min(Math.max(nextMax, hard.min), hard.max);
          const finalMin = Math.min(clampedMin, clampedMax);
          const finalMax = Math.max(clampedMin, clampedMax);
          const current = getEffects();
          onUpdate(
            current.map((e, i) => {
              if (i !== index) return e;
              const storedValue = e.params[param.key];
              const storedDisplay =
                typeof storedValue === "number"
                  ? storedValue * scale
                  : undefined;
              const clampedDisplay =
                storedDisplay === undefined
                  ? undefined
                  : Math.min(Math.max(storedDisplay, finalMin), finalMax);
              return {
                ...e,
                params:
                  clampedDisplay === undefined
                    ? e.params
                    : { ...e.params, [param.key]: clampedDisplay / scale },
                paramRanges: {
                  ...e.paramRanges,
                  [param.key]: { min: finalMin, max: finalMax },
                },
              };
            }),
          );
        };

        const resetRange = (): void => {
          const current = getEffects();
          onUpdate(
            current.map((e, i) => {
              if (i !== index || !e.paramRanges) return e;
              const { [param.key]: _dropped, ...restRanges } = e.paramRanges;
              return { ...e, paramRanges: restRanges };
            }),
          );
        };

        const isDrifting = (): boolean =>
          getEffects()[index]?.drift?.[param.key] !== undefined;

        const driftSpeed = (): number =>
          getEffects()[index]?.drift?.[param.key]?.speed ?? 0.5;

        const toggleDrift = (enabled: boolean): void => {
          const current = getEffects();
          onUpdate(
            current.map((e, i) => {
              if (i !== index) return e;
              if (!enabled) {
                const { [param.key]: _dropped, ...rest } = e.drift ?? {};
                return {
                  ...e,
                  drift: Object.keys(rest).length > 0 ? rest : undefined,
                };
              }
              return {
                ...e,
                drift: {
                  ...e.drift,
                  [param.key]: { speed: e.drift?.[param.key]?.speed ?? 0.5 },
                },
              };
            }),
          );
        };

        const setDriftSpeed = (speed: number): void => {
          const current = getEffects();
          onLiveUpdate(
            current.map((e, i) => {
              if (i !== index || !e.drift?.[param.key]) return e;
              return {
                ...e,
                drift: { ...e.drift, [param.key]: { speed } },
              };
            }),
          );
        };

        fields.push({
          key,
          label: param.label,
          kind: "range",
          value: storedNumber * scale,
          min: active.min,
          max: active.max,
          step: param.step,
          indented: true,
          labelCustomized: spec.paramRanges?.[param.key] !== undefined,
          labelDrifting: enableDrift === true && isDrifting(),
          onLabelClick: () =>
            openParamRangeModal(
              param.label,
              () => activeRangeFor(getEffects()[index], param),
              hard,
              param.step,
              commitRange,
              resetRange,
              !enableDrift
                ? undefined
                : {
                    enabled: isDrifting,
                    onToggle: toggleDrift,
                    speed: driftSpeed,
                    onSpeedChange: setDriftSpeed,
                  },
            ),
          onChange: (v) => onChange(v / scale),
        });
      }
    }
  });

  fields.push({
    key: "add-effect-type",
    label: "Add effect…",
    kind: "select",
    value: pendingEffectType,
    options: EFFECT_TABLE.map((e) => ({ value: e.type, label: e.label })),
    onChange: (v) => {
      pendingEffectType = v as EffectType;
    },
  });
  fields.push({
    key: "add-effect-button",
    label: "Add",
    kind: "button",
    onClick: () => {
      const table = EFFECT_TABLE.find((e) => e.type === pendingEffectType);
      if (!table) return;
      const current = getEffects();
      onUpdate([
        ...current,
        {
          type: table.type,
          params: Object.fromEntries(
            table.params.map((p) => [p.key, p.default]),
          ),
        },
      ]);
    },
  });

  if (effects.length > 0) {
    fields.push({
      // Fresh random value per param, within whatever range is currently
      // active for it (activeRangeFor -- a per-instance custom range if
      // one's set, else the table default) -- reusing the exact same
      // bounds Drift already wanders within, so "reroll" can never jump
      // further than a user-set custom range already allows. Unlike
      // more-like-this's small nudges, this also re-picks each select
      // param (e.g. filter type) since a full reroll is meant to be a
      // bigger jump, not a nudge.
      key: "reroll-chain",
      label: "Reroll chain",
      kind: "button",
      onClick: () => {
        const current = getEffects();
        onUpdate(
          current.map((spec) => {
            const table = EFFECT_TABLE.find((e) => e.type === spec.type);
            if (!table) return spec;
            const nextParams: Record<string, number | string> = {
              ...spec.params,
            };
            for (const param of table.params) {
              if (param.kind === "select") {
                nextParams[param.key] =
                  param.options[
                    Math.floor(Math.random() * param.options.length)
                  ];
              } else {
                const active = activeRangeFor(spec, param);
                const display =
                  active.min + Math.random() * (active.max - active.min);
                nextParams[param.key] = display / (param.scale ?? 1);
              }
            }
            return { ...spec, params: nextParams };
          }),
        );
      },
    });
  }

  if (effects.length > 0 && onSaveAsPreset) {
    fields.push({
      key: "save-chain-preset",
      label: "Save chain as preset…",
      kind: "button",
      onClick: () => {
        const name = window.prompt("Name this effect chain preset:");
        if (!name?.trim()) return;
        onSaveAsPreset(getEffects(), name.trim());
      },
    });
  }

  return fields;
}
