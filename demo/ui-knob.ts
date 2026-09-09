// A JS-side import, not a <link> in ui-knob.html: this demo's own Vite
// dev server roots at demo/, so a plain HTML <link href="../src/ui/
// knob.css"> can't resolve outside that root (silently falls through to
// the SPA-fallback index.html instead, leaving the dial's own <div>s at
// their default zero size -- present but invisible/unclickable, no
// console error). A CSS import inside a .ts file goes through Vite's
// full module graph instead, which does resolve outside-root paths (see
// this same file's own "../src/ui/knob" import, one line down) -- no
// other component demo needs this because none of them render an
// element with no other source of intrinsic size.
import "../src/ui/knob.css";
import { createKnob } from "../src/ui/knob";

const linearRow = document.querySelector<HTMLDivElement>("#linear-row")!;
const logRow = document.querySelector<HTMLDivElement>("#log-row")!;

function addKnob(
  row: HTMLDivElement,
  options: Parameters<typeof createKnob>[1],
): void {
  const el = document.createElement("div");
  row.appendChild(el);
  createKnob(el, options);
}

let linearMin = 0;
let linearMax = 100;
addKnob(linearRow, {
  value: 50,
  min: linearMin,
  max: linearMax,
  step: 1,
  scale: "linear",
  onChange: (value) => console.log("linear", value),
  onBoundsChange: (min, max) => {
    linearMin = min;
    linearMax = max;
    console.log("linear bounds", min, max);
  },
  onScaleChange: (scale) => console.log("linear scale", scale),
});

let logMin = 20;
let logMax = 20000;
addKnob(logRow, {
  value: 440,
  min: logMin,
  max: logMax,
  step: 1,
  scale: "log",
  onChange: (value) => console.log("log", value),
  onBoundsChange: (min, max) => {
    logMin = min;
    logMax = max;
    console.log("log bounds", min, max);
  },
  onScaleChange: (scale) => console.log("log scale", scale),
});
