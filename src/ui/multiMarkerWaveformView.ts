// A sibling to multiRangeWaveformView.ts for the case where a host app
// wants only a single draggable position per entry, not a {start, end}
// range -- one waveform, many independently-colored, independently-
// draggable single-line markers, keyed by caller-supplied id. Reuses
// waveformRangeView.ts's per-pixel min/max peak drawing and the same
// persistent-DOM-elements/reposition-in-place drag technique
// multiRangeWaveformView.ts already established (see its own doc comment
// for why a full rebuild mid-drag would silently break pointer capture).
//
// Adds right-click support over multiRangeWaveformView: each marker's hit
// area distinguishes a left-click drag (onSelect + onChange) from a
// right-click (onContextMenu, e.g. for a host app's own params menu) via
// PointerEvent.button, since a naive pointerdown handler would otherwise
// start a drag on a right-click too and the browser's native context menu
// would need suppressing either way.

const SVG_NS = "http://www.w3.org/2000/svg";

export interface MarkerEntry {
  id: string;
  /** 0..1 fraction of the loaded buffer's own duration. */
  position: number;
  /** Any valid CSS color -- stroke for this entry's marker line. */
  color: string;
  label?: string;
}

export interface MultiMarkerWaveformViewOptions {
  width?: number;
  height?: number;
  onChange?: (id: string, position: number) => void;
  /** Fired on a left-click/drag-start over an entry's marker -- a host app
   * typically uses this to sync its own "selected node" state. */
  onSelect?: (id: string) => void;
  /** Fired on a right-click over an entry's marker (the browser's own
   * context menu is suppressed) -- clientX/clientY are viewport
   * coordinates, for a host app to position its own popup menu at. */
  onContextMenu?: (id: string, clientX: number, clientY: number) => void;
}

export interface MultiMarkerWaveformViewHandle {
  setBuffer(buffer: AudioBuffer): void;
  /** Full replace -- add/remove/reorder entries in one call. */
  setMarkers(entries: MarkerEntry[]): void;
  setPosition(id: string, position: number): void;
  getPosition(id: string): number | undefined;
  /** Draws the given entry's marker on top and styled distinctly; `null`
   * clears the selection highlight. Purely visual -- does not affect
   * onSelect, which fires from user interaction instead. */
  setSelected(id: string | null): void;
  /** A second, non-interactive, dashed marker per entry for a "live"
   * position that's drifted away from its authored base position (see
   * relpmas's range motion) -- `null` clears one entry's overlay. */
  setLiveMarker(id: string, position: number | null): void;
}

interface EntryElements {
  group: SVGGElement;
  hitArea: SVGRectElement;
  handle: SVGLineElement;
  label: SVGTextElement | null;
  liveMarker: SVGLineElement | null;
}

// Wider than the visible line itself so a thin marker stays easy to grab
// and easy to right-click -- the only interactive element per node now
// that ranges aren't drawn, unlike multiRangeWaveformView where the wide
// fill rect already doubled as a generous hit target.
const HIT_WIDTH = 14;

export function createMultiMarkerWaveformView(
  container: HTMLDivElement,
  options: MultiMarkerWaveformViewOptions = {},
): MultiMarkerWaveformViewHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 100;

  const entries = new Map<string, MarkerEntry>();
  const elements = new Map<string, EntryElements>();
  const liveMarkers = new Map<string, number>();
  let selectedId: string | null = null;
  let buffer: AudioBuffer | null = null;
  let svg: SVGSVGElement | null = null;
  let waveformPolygon: SVGPolygonElement | null = null;
  // True for the duration of any entry's drag -- see setSelected's own
  // comment for why the z-order reorder it normally does has to be
  // deferred until pointerup while this is true, not just skipped when
  // the dragged entry happens to already be selected.
  let dragInProgress = false;

  /** Moves the currently-selected entry's group to the end of the SVG
   * (drawn on top) if it isn't already there -- the one place that does
   * this reorder, called either immediately (selection changed outside a
   * drag) or deferred to pointerup (selection changed *by* a drag-start,
   * see setSelected). */
  function reorderSelectedToTop(): void {
    const el = selectedId ? elements.get(selectedId) : null;
    if (el && svg && svg.lastElementChild !== el.group) {
      svg.appendChild(el.group);
    }
  }

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
    const x = entry.position * width;
    el.handle.setAttribute("x1", String(x));
    el.handle.setAttribute("x2", String(x));
    el.hitArea.setAttribute("x", String(x - HIT_WIDTH / 2));
    if (el.label) el.label.setAttribute("x", String(x + 3));

    const live = liveMarkers.get(id);
    if (live !== undefined && el.liveMarker) {
      const liveX = live * width;
      el.liveMarker.setAttribute("x1", String(liveX));
      el.liveMarker.setAttribute("x2", String(liveX));
    }
  }

  /** Builds (or fully replaces) one entry's DOM group -- only called for
   * structural changes, never during a drag. */
  function buildEntry(entry: MarkerEntry): EntryElements {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "multi-marker-entry");

    const handle = document.createElementNS(SVG_NS, "line");
    handle.setAttribute("y1", "0");
    handle.setAttribute("y2", String(height));
    handle.setAttribute("class", "multi-marker-handle");
    handle.setAttribute("stroke", entry.color);
    group.appendChild(handle);

    // The actual pointer target -- wider than the visible handle line, and
    // drawn on top of it (later in the group) so it's what actually
    // receives events; the line above is purely visual.
    const hitArea = document.createElementNS(SVG_NS, "rect");
    hitArea.setAttribute("class", "multi-marker-hit-area");
    hitArea.setAttribute("y", "0");
    hitArea.setAttribute("width", String(HIT_WIDTH));
    hitArea.setAttribute("height", String(height));

    let dragging = false;
    hitArea.addEventListener("pointerdown", (event) => {
      // Only the left/primary button starts a drag -- a right-click's own
      // pointerdown must NOT also begin a drag, or the subsequent
      // contextmenu event fires against garbled state.
      if (event.button !== 0) return;
      dragging = true;
      dragInProgress = true;
      hitArea.setPointerCapture(event.pointerId);
      // Starting a drag on a not-yet-selected entry changes selection
      // (via this call, round-tripping through the host app's onSelect
      // back into setSelected below) in the very same synchronous handler
      // that just requested capture above. setSelected's own reorder
      // (drawing the newly-selected entry's group on top) would normally
      // remove-then-reinsert this exact hitArea's ancestor -- and removing
      // a node from the DOM implicitly releases any pointer capture on it
      // or its descendants, killing the drag before its first move. The
      // dragInProgress flag makes setSelected defer that reorder to
      // pointerup instead, where it's safe (capture is ending anyway).
      options.onSelect?.(entry.id);
    });
    hitArea.addEventListener("pointermove", (event) => {
      if (!dragging || !svg) return;
      const bounds = svg.getBoundingClientRect();
      const localX = ((event.clientX - bounds.left) / bounds.width) * width;
      const current = entries.get(entry.id);
      if (!current) return;
      current.position = Math.min(1, Math.max(0, localX / width));
      reposition(entry.id);
      options.onChange?.(entry.id, current.position);
    });
    hitArea.addEventListener("pointerup", () => {
      dragging = false;
      dragInProgress = false;
      // Capture (and the drag it protected) is over -- safe to apply
      // whatever reorder setSelected deferred while it was active.
      reorderSelectedToTop();
      applyStyles();
    });
    hitArea.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      options.onSelect?.(entry.id);
      options.onContextMenu?.(entry.id, event.clientX, event.clientY);
    });
    group.appendChild(hitArea);

    let label: SVGTextElement | null = null;
    if (entry.label) {
      label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("class", "multi-marker-label");
      label.setAttribute("y", "12");
      label.setAttribute("fill", entry.color);
      label.textContent = entry.label;
      label.style.pointerEvents = "none";
      group.appendChild(label);
    }

    let liveMarker: SVGLineElement | null = null;
    if (liveMarkers.has(entry.id)) {
      liveMarker = document.createElementNS(SVG_NS, "line");
      liveMarker.setAttribute("class", "multi-marker-live");
      liveMarker.setAttribute("y1", "0");
      liveMarker.setAttribute("y2", String(height));
      liveMarker.setAttribute("stroke", entry.color);
      liveMarker.style.pointerEvents = "none";
      group.appendChild(liveMarker);
    }

    return { group, hitArea, handle, label, liveMarker };
  }

  function applyStyles(): void {
    for (const [id, el] of elements) {
      const isSelected = id === selectedId;
      el.handle.setAttribute("stroke-width", isSelected ? "4" : "2");
    }
  }

  /** Full structural rebuild: buffer swap, entries added/removed, or an
   * entry's live-marker presence toggling. Never called mid-drag. */
  function rebuild(): void {
    if (!svg) return;
    svg.innerHTML = "";
    elements.clear();

    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("class", "multi-marker-waveform-line");
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
      el.setAttribute("class", "multi-marker-waveform-svg");
      container.appendChild(el);
      svg = el;
    }
    rebuild();
  }

  return {
    setBuffer,
    setMarkers(newEntries) {
      entries.clear();
      for (const entry of newEntries) entries.set(entry.id, { ...entry });
      rebuild();
    },
    setPosition(id, position) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.position = position;
      reposition(id);
    },
    getPosition(id) {
      return entries.get(id)?.position;
    },
    setSelected(id) {
      if (id === selectedId) return;
      selectedId = id;
      // While a drag is in progress, its own pointerdown handler already
      // called this (that's how selection changes to begin with, for an
      // entry that wasn't already selected) and will reorder once it's
      // safe to, at pointerup -- see reorderSelectedToTop's own doc and
      // pointerdown's comment. Reordering here too, synchronously, is
      // exactly the DOM-removal-releases-capture hazard both of those
      // comments describe; outside a drag (e.g. a host app selecting a
      // node some other way, like clicking a list item) there's no
      // capture at risk, so it's safe to do immediately.
      if (!dragInProgress) reorderSelectedToTop();
      applyStyles();
    },
    setLiveMarker(id, position) {
      const hadMarker = liveMarkers.has(id);
      if (position !== null) liveMarkers.set(id, position);
      else liveMarkers.delete(id);
      // Presence changing (not just the position value) needs a rebuild
      // since it adds/removes the marker <line> itself; otherwise just
      // reposition.
      if (hadMarker !== liveMarkers.has(id)) {
        rebuild();
      } else {
        reposition(id);
      }
    },
  };
}
