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
