import { createMultiRangeWaveformView } from "../src/ui/multiRangeWaveformView";
import type { WaveformRange } from "../src/ui/waveformRangeView";
import { unlockAudioContext } from "./shared/audioContext";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const selectedTextEl =
  document.querySelector<HTMLParagraphElement>("#selected-text")!;
const addButtonEl = document.querySelector<HTMLButtonElement>("#add-node")!;
const removeButtonEl =
  document.querySelector<HTMLButtonElement>("#remove-node")!;
const driftToggleEl =
  document.querySelector<HTMLInputElement>("#drift-toggle")!;

const COLORS = ["#ffb454", "#4c7dff", "#6fdc8c", "#ff6b9d", "#c792ea"];

interface NodeState {
  id: string;
  range: WaveformRange;
  color: string;
}

let nextIndex = 1;
const nodes: NodeState[] = [
  { id: "node-1", range: { start: 0.05, end: 0.3 }, color: COLORS[0] },
  { id: "node-2", range: { start: 0.35, end: 0.65 }, color: COLORS[1] },
  { id: "node-3", range: { start: 0.2, end: 0.9 }, color: COLORS[2] },
];
nextIndex = nodes.length + 1;
let selectedId: string | null = nodes[0].id;

unlockAudioContext(unlockEl).then((audioContext) => {
  const view = createMultiRangeWaveformView(waveformEl, {
    onChange: (id, range) => {
      const node = nodes.find((n) => n.id === id);
      if (node) node.range = range;
      updateSelectedText();
    },
    onSelect: (id) => {
      selectedId = id;
      view.setSelected(id);
      updateSelectedText();
    },
  });

  function syncEntries(): void {
    view.setEntries(nodes.map((n) => ({ ...n, label: n.id })));
    view.setSelected(selectedId);
  }

  function updateSelectedText(): void {
    const node = nodes.find((n) => n.id === selectedId);
    selectedTextEl.textContent = node
      ? `${node.id}: start ${(node.range.start * 100).toFixed(1)}%  end ${(node.range.end * 100).toFixed(1)}%`
      : "no node selected";
  }

  let buffer = createTestBuffer(audioContext);
  view.setBuffer(buffer);
  syncEntries();
  updateSelectedText();

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    view.setBuffer(buffer);
    syncEntries();
  });

  addButtonEl.addEventListener("click", () => {
    const id = `node-${nextIndex++}`;
    const color = COLORS[nodes.length % COLORS.length];
    nodes.push({ id, range: { start: 0.1, end: 0.4 }, color });
    selectedId = id;
    syncEntries();
    updateSelectedText();
  });

  removeButtonEl.addEventListener("click", () => {
    if (!selectedId) return;
    const idx = nodes.findIndex((n) => n.id === selectedId);
    if (idx === -1) return;
    nodes.splice(idx, 1);
    selectedId = nodes[0]?.id ?? null;
    syncEntries();
    updateSelectedText();
  });

  // Simulates relpmas's range-motion live overlay: a dashed region per node
  // wandering independently, purely so the overlay rendering itself (drawn
  // on top of the authored base range, non-interactive) can be eyeballed
  // without needing the full scheduler this widget doesn't know about.
  let driftHandle: ReturnType<typeof setInterval> | null = null;
  driftToggleEl.addEventListener("change", () => {
    if (driftToggleEl.checked) {
      const t0 = performance.now();
      driftHandle = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        for (const node of nodes) {
          const span = node.range.end - node.range.start;
          const wobble = 0.15 * Math.sin(t * (1 + nodes.indexOf(node) * 0.4));
          const start = Math.min(
            1 - span,
            Math.max(0, node.range.start + wobble),
          );
          view.setLiveOverlay(node.id, { start, end: start + span });
        }
      }, 100);
    } else if (driftHandle) {
      clearInterval(driftHandle);
      driftHandle = null;
      for (const node of nodes) view.setLiveOverlay(node.id, null);
    }
  });
});
