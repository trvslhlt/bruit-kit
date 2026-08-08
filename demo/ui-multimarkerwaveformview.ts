import { createMultiMarkerWaveformView } from "../src/ui/multiMarkerWaveformView";
import { unlockAudioContext } from "./shared/audioContext";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const selectedTextEl =
  document.querySelector<HTMLParagraphElement>("#selected-text")!;
const contextMenuTextEl =
  document.querySelector<HTMLParagraphElement>("#contextmenu-text")!;
const addButtonEl = document.querySelector<HTMLButtonElement>("#add-node")!;
const removeButtonEl =
  document.querySelector<HTMLButtonElement>("#remove-node")!;
const driftToggleEl =
  document.querySelector<HTMLInputElement>("#drift-toggle")!;

const COLORS = ["#ffb454", "#4c7dff", "#6fdc8c", "#ff6b9d", "#c792ea"];

interface NodeState {
  id: string;
  position: number;
  color: string;
}

let nextIndex = 1;
const nodes: NodeState[] = [
  { id: "node-1", position: 0.15, color: COLORS[0] },
  { id: "node-2", position: 0.45, color: COLORS[1] },
  { id: "node-3", position: 0.75, color: COLORS[2] },
];
nextIndex = nodes.length + 1;
let selectedId: string | null = nodes[0].id;

unlockAudioContext(unlockEl).then((audioContext) => {
  const view = createMultiMarkerWaveformView(waveformEl, {
    onChange: (id, position) => {
      const node = nodes.find((n) => n.id === id);
      if (node) node.position = position;
      updateSelectedText();
    },
    onSelect: (id) => {
      selectedId = id;
      view.setSelected(id);
      updateSelectedText();
    },
    onContextMenu: (id, clientX, clientY) => {
      contextMenuTextEl.textContent = `right-clicked ${id} at (${clientX}, ${clientY})`;
    },
  });

  function syncMarkers(): void {
    view.setMarkers(nodes.map((n) => ({ ...n, label: n.id })));
    view.setSelected(selectedId);
  }

  function updateSelectedText(): void {
    const node = nodes.find((n) => n.id === selectedId);
    selectedTextEl.textContent = node
      ? `${node.id}: position ${(node.position * 100).toFixed(1)}%`
      : "no node selected";
  }

  let buffer = createTestBuffer(audioContext);
  view.setBuffer(buffer);
  syncMarkers();
  updateSelectedText();

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    view.setBuffer(buffer);
    syncMarkers();
  });

  addButtonEl.addEventListener("click", () => {
    const id = `node-${nextIndex++}`;
    const color = COLORS[nodes.length % COLORS.length];
    nodes.push({ id, position: 0.3, color });
    selectedId = id;
    syncMarkers();
    updateSelectedText();
  });

  removeButtonEl.addEventListener("click", () => {
    if (!selectedId) return;
    const idx = nodes.findIndex((n) => n.id === selectedId);
    if (idx === -1) return;
    nodes.splice(idx, 1);
    selectedId = nodes[0]?.id ?? null;
    syncMarkers();
    updateSelectedText();
  });

  // Simulates relpmas's range-motion live marker: a dashed line per node
  // wandering independently.
  let driftHandle: ReturnType<typeof setInterval> | null = null;
  driftToggleEl.addEventListener("change", () => {
    if (driftToggleEl.checked) {
      const t0 = performance.now();
      driftHandle = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        for (const node of nodes) {
          const wobble = 0.15 * Math.sin(t * (1 + nodes.indexOf(node) * 0.4));
          const position = Math.min(1, Math.max(0, node.position + wobble));
          view.setLiveMarker(node.id, position);
        }
      }, 100);
    } else if (driftHandle) {
      clearInterval(driftHandle);
      driftHandle = null;
      for (const node of nodes) view.setLiveMarker(node.id, null);
    }
  });
});
