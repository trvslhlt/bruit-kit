// A generalization of waveformRangeView.ts's single {start, end} drag-select
// widget: one waveform, many independently-colored, independently-draggable
// range regions, keyed by caller-supplied id -- for a host app (like
// relpmas) that needs many simultaneous named selections against one loaded
// buffer rather than one trim range. Reuses waveformRangeView's own
// WaveformRange shape and per-pixel min/max peak drawing; the new parts are
// per-entry color, a "selected" entry drawn on top for easier dragging when
// regions overlap, and a non-interactive "live" overlay per entry for
// showing a value that's drifted away from the authored base range.
//
// Each entry's handles/fill are persistent DOM elements, repositioned in
// place during a drag rather than torn down and rebuilt (the same pitfall
// fields.ts's own doc comment warns about for automationEditor): a drag is
// tracked via setPointerCapture on the handle element itself, and removing
// that element mid-gesture (as a full innerHTML rebuild would) silently
// ends the capture, breaking fast drags. Only structural changes (buffer
// swap, entries added/removed, selection change) rebuild; a drag just
// updates attributes on the entry's own existing elements.

// Not re-exported here -- waveformRangeView.ts already does via ui/index.ts's
// own `export *`, and a second `export type { WaveformRange }` here would
// collide with it (ambiguous re-export of the same name from two modules).
import type { WaveformRange } from "./waveformRangeView";

export interface MultiRangeEntry {
  id: string;
  range: WaveformRange;
  /** Any valid CSS color -- fill/stroke for this entry's region and handles. */
  color: string;
  label?: string;
}

export interface MultiRangeWaveformViewOptions {
  width?: number;
  height?: number;
  onChange?: (id: string, range: WaveformRange) => void;
  /** Fired on pointerdown over an entry's fill or either of its handles --
   * a host app typically uses this to sync its own "selected node" state. */
  onSelect?: (id: string) => void;
}

export interface MultiRangeWaveformViewHandle {
  setBuffer(buffer: AudioBuffer): void;
  /** Full replace -- add/remove/reorder entries in one call. */
  setEntries(entries: MultiRangeEntry[]): void;
  setRange(id: string, range: WaveformRange): void;
  getRange(id: string): WaveformRange | undefined;
  /** Draws the given entry's handles on top and styled distinctly; `null`
   * clears the selection highlight. Purely visual -- does not affect
   * onSelect, which fires from user interaction instead. */
  setSelected(id: string | null): void;
  /** A second, non-interactive, dashed region per entry for a "live" value
   * that's drifted away from its authored base range (see relpmas's range
   * motion) -- `null` clears one entry's overlay. */
  setLiveOverlay(id: string, range: WaveformRange | null): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

interface EntryElements {
  group: SVGGElement;
  fill: SVGRectElement;
  startHandle: SVGLineElement;
  endHandle: SVGLineElement;
  label: SVGTextElement | null;
  liveOverlay: SVGRectElement | null;
}

export function createMultiRangeWaveformView(
  container: HTMLDivElement,
  options: MultiRangeWaveformViewOptions = {},
): MultiRangeWaveformViewHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 120;

  const entries = new Map<string, MultiRangeEntry>();
  const elements = new Map<string, EntryElements>();
  const liveOverlays = new Map<string, WaveformRange>();
  let selectedId: string | null = null;
  let buffer: AudioBuffer | null = null;
  let svg: SVGSVGElement | null = null;
  let waveformPolygon: SVGPolygonElement | null = null;

  function drawWaveform(): void {
    if (!svg || !buffer || !waveformPolygon) return;
    const midY = height / 2;
    const channelData = buffer.getChannelData(0);
    const samplesPerColumn = Math.max(
      1,
      Math.floor(channelData.length / width),
    );
    const topPoints: string[] = [];
    const bottomPoints: string[] = [];
    for (let x = 0; x < width; x++) {
      const start = x * samplesPerColumn;
      const end = Math.min(channelData.length, start + samplesPerColumn);
      let max = 0;
      let min = 0;
      for (let i = start; i < end; i++) {
        const value = channelData[i];
        if (value > max) max = value;
        if (value < min) min = value;
      }
      topPoints.push(`${x},${midY - max * midY}`);
      bottomPoints.push(`${x},${midY - min * midY}`);
    }
    waveformPolygon.setAttribute(
      "points",
      [...topPoints, ...bottomPoints.reverse()].join(" "),
    );
  }

  /** Cheap in-place update of one entry's existing elements -- safe to call
   * mid-drag (see the module doc comment for why this can't just be
   * `rebuild()`). */
  function reposition(id: string): void {
    const entry = entries.get(id);
    const el = elements.get(id);
    if (!entry || !el) return;
    const x1 = entry.range.start * width;
    const x2 = entry.range.end * width;
    el.fill.setAttribute("x", String(Math.min(x1, x2)));
    el.fill.setAttribute("width", String(Math.abs(x2 - x1)));
    el.startHandle.setAttribute("x1", String(x1));
    el.startHandle.setAttribute("x2", String(x1));
    el.endHandle.setAttribute("x1", String(x2));
    el.endHandle.setAttribute("x2", String(x2));
    if (el.label) el.label.setAttribute("x", String(Math.min(x1, x2) + 3));

    const live = liveOverlays.get(id);
    if (live && el.liveOverlay) {
      el.liveOverlay.setAttribute("x", String(live.start * width));
      el.liveOverlay.setAttribute(
        "width",
        String(Math.max(0, (live.end - live.start) * width)),
      );
    }
  }

  function makeHandle(
    entryId: string,
    onDrag: (localX: number) => void,
  ): SVGLineElement {
    const handle = document.createElementNS(SVG_NS, "line");
    handle.setAttribute("y1", "0");
    handle.setAttribute("y2", String(height));
    handle.classList.add("multi-range-handle");

    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      handle.setPointerCapture(event.pointerId);
      options.onSelect?.(entryId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging || !svg) return;
      const bounds = svg.getBoundingClientRect();
      const localX = ((event.clientX - bounds.left) / bounds.width) * width;
      onDrag(localX);
      reposition(entryId);
      const entry = entries.get(entryId);
      if (entry) options.onChange?.(entryId, { ...entry.range });
    });
    handle.addEventListener("pointerup", () => {
      dragging = false;
    });
    return handle;
  }

  /** Builds (or fully replaces) one entry's DOM group -- only called for
   * structural changes, never during a drag. */
  function buildEntry(entry: MultiRangeEntry): EntryElements {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "multi-range-entry");

    const fill = document.createElementNS(SVG_NS, "rect");
    fill.setAttribute("class", "multi-range-fill");
    fill.setAttribute("y", "0");
    fill.setAttribute("height", String(height));
    fill.setAttribute("fill", entry.color);
    fill.addEventListener("pointerdown", () => options.onSelect?.(entry.id));
    group.appendChild(fill);

    const startHandle = makeHandle(entry.id, (localX) => {
      const current = entries.get(entry.id);
      if (!current) return;
      const maxX = current.range.end * width;
      current.range.start = Math.min(maxX, Math.max(0, localX)) / width;
    });
    startHandle.setAttribute("stroke", entry.color);
    group.appendChild(startHandle);

    const endHandle = makeHandle(entry.id, (localX) => {
      const current = entries.get(entry.id);
      if (!current) return;
      const minX = current.range.start * width;
      current.range.end = Math.min(width, Math.max(minX, localX)) / width;
    });
    endHandle.setAttribute("stroke", entry.color);
    group.appendChild(endHandle);

    let label: SVGTextElement | null = null;
    if (entry.label) {
      label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("class", "multi-range-label");
      label.setAttribute("y", "12");
      label.setAttribute("fill", entry.color);
      label.textContent = entry.label;
      group.appendChild(label);
    }

    let liveOverlay: SVGRectElement | null = null;
    if (liveOverlays.has(entry.id)) {
      liveOverlay = document.createElementNS(SVG_NS, "rect");
      liveOverlay.setAttribute("class", "multi-range-live");
      liveOverlay.setAttribute("y", "0");
      liveOverlay.setAttribute("height", String(height));
      liveOverlay.setAttribute("stroke", entry.color);
      group.appendChild(liveOverlay);
    }

    return { group, fill, startHandle, endHandle, label, liveOverlay };
  }

  function applyStyles(): void {
    for (const [id, el] of elements) {
      const isSelected = id === selectedId;
      el.fill.setAttribute("opacity", isSelected ? "0.28" : "0.14");
      el.startHandle.setAttribute("stroke-width", isSelected ? "4" : "2");
      el.endHandle.setAttribute("stroke-width", isSelected ? "4" : "2");
    }
  }

  /** Full structural rebuild: buffer swap, entries added/removed, or an
   * entry's live-overlay presence toggling. Never called mid-drag. */
  function rebuild(): void {
    if (!svg) return;
    svg.innerHTML = "";
    elements.clear();

    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("class", "multi-range-waveform-line");
    svg.appendChild(polygon);
    waveformPolygon = polygon;
    drawWaveform();

    const ordered = [...entries.values()].sort((a, b) =>
      a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0,
    );
    for (const entry of ordered) {
      const el = buildEntry(entry);
      elements.set(entry.id, el);
      svg.appendChild(el.group);
      reposition(entry.id);
    }
    applyStyles();
  }

  function setBuffer(newBuffer: AudioBuffer): void {
    buffer = newBuffer;
    if (!svg) {
      container.innerHTML = "";
      const el = document.createElementNS(SVG_NS, "svg");
      el.setAttribute("viewBox", `0 0 ${width} ${height}`);
      el.setAttribute("preserveAspectRatio", "none");
      el.setAttribute("class", "multi-range-waveform-svg");
      container.appendChild(el);
      svg = el;
    }
    rebuild();
  }

  return {
    setBuffer,
    setEntries(newEntries) {
      entries.clear();
      for (const entry of newEntries) {
        entries.set(entry.id, { ...entry, range: { ...entry.range } });
      }
      rebuild();
    },
    setRange(id, range) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.range = { ...range };
      reposition(id);
    },
    getRange(id) {
      const entry = entries.get(id);
      return entry ? { ...entry.range } : undefined;
    },
    setSelected(id) {
      // No-op if this entry is already selected -- critically, not just an
      // optimization: makeHandle's own pointerdown handler calls
      // options.onSelect (hence this) *after* setPointerCapture, on every
      // press including a drag-to-resize of an already-selected entry's own
      // handle. Reordering the DOM (appendChild below) on that redundant
      // call would immediately release the capture just requested in the
      // same event handler -- appendChild of an already-attached node is a
      // remove-then-reinsert, and removing a node from the DOM implicitly
      // releases any pointer capture on it or its descendants. Skipping the
      // reorder when nothing actually changed is what keeps a drag alive.
      if (id === selectedId) return;
      selectedId = id;
      // Selection changes z-order (selected entry draws on top) as well as
      // style, so this needs the group reordered -- appendChild on an
      // already-attached node moves it without recreating it, so any
      // in-progress drag *of a different entry* than the one being
      // reordered keeps its own pointer capture.
      const el = selectedId ? elements.get(selectedId) : null;
      if (el && svg) svg.appendChild(el.group);
      applyStyles();
    },
    setLiveOverlay(id, range) {
      const hadOverlay = liveOverlays.has(id);
      if (range) liveOverlays.set(id, range);
      else liveOverlays.delete(id);
      // Presence changing (not just the range value) needs a rebuild since
      // it adds/removes the overlay <rect> itself; otherwise just reposition.
      if (hadOverlay !== liveOverlays.has(id)) {
        rebuild();
      } else {
        reposition(id);
      }
    },
  };
}
