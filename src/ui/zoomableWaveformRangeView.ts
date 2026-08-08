// A single {start, end} range editor like waveformRangeView.ts, but with a
// zoomable/pannable view window on top: at 1x zoom it's the same "drag two
// handles across the whole buffer" widget, but a zoom slider (and mouse
// wheel over the waveform) narrows the visible window so a long buffer's
// fine detail is reachable, with a scrollbar below the waveform to pan
// once zoomed in. A new, standalone widget rather than an added mode on
// waveformRangeView.ts itself -- that one has existing consumers
// (grid-sequencer's sampleEditorModal.ts) that don't expect a zoom UI to
// appear, and bruit-kit's own convention is small focused widgets over one
// widget with a growing options surface (see multiRangeWaveformView.ts/
// multiMarkerWaveformView.ts, each standalone rather than modes of
// waveformRangeView.ts).
//
// Unlike the multi-* widgets, there's exactly one range here, so none of
// their z-order/selection machinery applies -- one set of handles, no
// entries competing for paint order, so no dragInProgress-style guard is
// needed (nothing here ever reorders the DOM out from under an active
// drag).

// Not re-exported here -- waveformRangeView.ts already does via ui/index.ts's
// own `export *`, and a second `export type { WaveformRange }` here would
// collide with it (ambiguous re-export of the same name from two modules;
// see multiRangeWaveformView.ts's identical situation).
import type { WaveformRange } from "./waveformRangeView";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface ZoomableWaveformRangeViewOptions {
  width?: number;
  height?: number;
  initialRange?: WaveformRange;
  onChange?: (range: WaveformRange) => void;
}

export interface ZoomableWaveformRangeViewHandle {
  setBuffer(buffer: AudioBuffer): void;
  getRange(): WaveformRange;
  setRange(range: WaveformRange): void;
  /** A non-interactive marker (e.g. a node's live, motion-drifted start
   * position) drawn over the waveform -- `null` clears it. Off-screen at
   * the current zoom/pan is simply not drawn, not clamped into view. */
  setLiveMarker(position: number | null): void;
}

// Narrowest zoomable window -- ~500x zoom at the slider's max, and a floor
// that keeps view width comfortably away from 0 (a zero-width view would
// make the buffer-position math below divide by zero).
const MIN_VIEW_WIDTH = 0.002;

export function createZoomableWaveformRangeView(
  container: HTMLDivElement,
  options: ZoomableWaveformRangeViewOptions = {},
): ZoomableWaveformRangeViewHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 100;

  const range: WaveformRange = {
    ...(options.initialRange ?? { start: 0, end: 1 }),
  };
  let viewStart = 0;
  let viewEnd = 1;
  let buffer: AudioBuffer | null = null;
  let liveMarkerPos: number | null = null;

  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "zoomable-waveform-range-wrapper";
  container.appendChild(wrapper);

  // Positioning context for the zoom buttons, which overlay the waveform's
  // top-right corner instead of taking their own row -- see the zoom
  // in/out buttons below.
  const svgStack = document.createElement("div");
  svgStack.className = "zoomable-waveform-svg-stack";
  wrapper.appendChild(svgStack);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "zoomable-waveform-range-svg");
  svgStack.appendChild(svg);

  const waveformPolygon = document.createElementNS(SVG_NS, "polygon");
  waveformPolygon.setAttribute("class", "zoomable-waveform-range-line");
  svg.appendChild(waveformPolygon);

  const beforeDim = document.createElementNS(SVG_NS, "rect");
  const afterDim = document.createElementNS(SVG_NS, "rect");
  for (const rect of [beforeDim, afterDim]) {
    rect.setAttribute("class", "zoomable-waveform-range-dim");
    rect.setAttribute("y", "0");
    rect.setAttribute("height", String(height));
    svg.appendChild(rect);
  }

  const liveMarkerLine = document.createElementNS(SVG_NS, "line");
  liveMarkerLine.setAttribute("class", "zoomable-waveform-range-live");
  liveMarkerLine.setAttribute("y1", "0");
  liveMarkerLine.setAttribute("y2", String(height));
  liveMarkerLine.style.display = "none";
  svg.appendChild(liveMarkerLine);

  function bufferPosToLocalX(pos: number): number {
    return ((pos - viewStart) / (viewEnd - viewStart)) * width;
  }
  function localXToBufferPos(localX: number): number {
    return viewStart + (localX / width) * (viewEnd - viewStart);
  }

  function makeHandle(onDrag: (bufferPos: number) => void): SVGLineElement {
    const handle = document.createElementNS(SVG_NS, "line");
    handle.setAttribute("y1", "0");
    handle.setAttribute("y2", String(height));
    handle.classList.add("zoomable-waveform-range-handle");

    handle.addEventListener("pointerdown", (event) => {
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const bounds = svg.getBoundingClientRect();
      const localX = ((event.clientX - bounds.left) / bounds.width) * width;
      onDrag(localXToBufferPos(localX));
      redrawHandles();
      options.onChange?.({ ...range });
    });
    return handle;
  }

  const startHandle = makeHandle((pos) => {
    range.start = Math.min(Math.max(pos, 0), range.end);
  });
  const endHandle = makeHandle((pos) => {
    range.end = Math.max(Math.min(pos, 1), range.start);
  });
  svg.append(startHandle, endHandle);

  function redrawHandles(): void {
    const x1 = bufferPosToLocalX(range.start);
    const x2 = bufferPosToLocalX(range.end);
    // Clamped into the visible width rather than hidden when the range
    // boundary is outside the current view -- keeps the handle reachable
    // (drag it back in) instead of vanishing with no indication of which
    // way to pan to find it.
    const clampedX1 = Math.max(0, Math.min(width, x1));
    const clampedX2 = Math.max(0, Math.min(width, x2));
    startHandle.setAttribute("x1", String(clampedX1));
    startHandle.setAttribute("x2", String(clampedX1));
    endHandle.setAttribute("x1", String(clampedX2));
    endHandle.setAttribute("x2", String(clampedX2));
    beforeDim.setAttribute("x", "0");
    beforeDim.setAttribute("width", String(clampedX1));
    afterDim.setAttribute("x", String(clampedX2));
    afterDim.setAttribute("width", String(Math.max(0, width - clampedX2)));

    if (
      liveMarkerPos !== null &&
      liveMarkerPos >= viewStart &&
      liveMarkerPos <= viewEnd
    ) {
      const liveX = bufferPosToLocalX(liveMarkerPos);
      liveMarkerLine.setAttribute("x1", String(liveX));
      liveMarkerLine.setAttribute("x2", String(liveX));
      liveMarkerLine.style.display = "";
    } else {
      liveMarkerLine.style.display = "none";
    }
  }

  function redrawWaveform(): void {
    if (!buffer) return;
    const channelData = buffer.getChannelData(0);
    const startSample = Math.floor(viewStart * channelData.length);
    const endSample = Math.ceil(viewEnd * channelData.length);
    const spanSamples = Math.max(1, endSample - startSample);
    const samplesPerColumn = Math.max(1, Math.floor(spanSamples / width));
    const midY = height / 2;
    const topPoints: string[] = [];
    const bottomPoints: string[] = [];
    for (let x = 0; x < width; x++) {
      const colStart = startSample + x * samplesPerColumn;
      const colEnd = Math.min(channelData.length, colStart + samplesPerColumn);
      let max = 0;
      let min = 0;
      for (let i = colStart; i < colEnd; i++) {
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

  // --- Scrollbar (pan) ---
  const scrollbarTrack = document.createElement("div");
  scrollbarTrack.className = "zoomable-waveform-scrollbar-track";
  const scrollbarThumb = document.createElement("div");
  scrollbarThumb.className = "zoomable-waveform-scrollbar-thumb";
  scrollbarTrack.appendChild(scrollbarThumb);
  wrapper.appendChild(scrollbarTrack);

  function redrawScrollbar(): void {
    scrollbarThumb.style.left = `${viewStart * 100}%`;
    scrollbarThumb.style.width = `${(viewEnd - viewStart) * 100}%`;
  }

  function setView(newStart: number, newEnd: number): void {
    const viewWidth = Math.max(MIN_VIEW_WIDTH, Math.min(1, newEnd - newStart));
    viewStart = Math.max(0, Math.min(1 - viewWidth, newStart));
    viewEnd = viewStart + viewWidth;
    redrawWaveform();
    redrawHandles();
    redrawScrollbar();
  }

  let panDragStartX = 0;
  let panDragStartViewStart = 0;
  scrollbarThumb.addEventListener("pointerdown", (event) => {
    scrollbarThumb.setPointerCapture(event.pointerId);
    panDragStartX = event.clientX;
    panDragStartViewStart = viewStart;
  });
  scrollbarThumb.addEventListener("pointermove", (event) => {
    if (!scrollbarThumb.hasPointerCapture(event.pointerId)) return;
    const trackWidth = scrollbarTrack.getBoundingClientRect().width;
    const deltaFraction = (event.clientX - panDragStartX) / trackWidth;
    const viewWidth = viewEnd - viewStart;
    setView(
      panDragStartViewStart + deltaFraction,
      panDragStartViewStart + deltaFraction + viewWidth,
    );
  });
  // Clicking the track itself (not the thumb) re-centers the view there --
  // standard "jump to this part of the scrollbar" behavior.
  scrollbarTrack.addEventListener("pointerdown", (event) => {
    if (event.target !== scrollbarTrack) return;
    const trackBounds = scrollbarTrack.getBoundingClientRect();
    const clickFraction =
      (event.clientX - trackBounds.left) / trackBounds.width;
    const viewWidth = viewEnd - viewStart;
    setView(clickFraction - viewWidth / 2, clickFraction + viewWidth / 2);
    syncZoomSlider();
  });

  // --- Zoom slider + wheel-to-zoom ---
  const zoomRow = document.createElement("div");
  zoomRow.className = "zoomable-waveform-zoom-row";
  const zoomLabel = document.createElement("span");
  zoomLabel.className = "zoomable-waveform-zoom-label";
  zoomLabel.textContent = "Zoom";
  const zoomInput = document.createElement("input");
  zoomInput.type = "range";
  zoomInput.min = "0";
  zoomInput.max = "1";
  zoomInput.step = "0.001";
  zoomInput.value = "0";
  zoomRow.append(zoomLabel, zoomInput);
  wrapper.appendChild(zoomRow);

  // Zoom in/out buttons overlay the waveform's top-right corner rather than
  // sitting in their own row below -- keeps the widget's footprint down to
  // waveform + scrollbar + slider instead of an extra control row.
  const zoomControls = document.createElement("div");
  zoomControls.className = "zoomable-waveform-zoom-controls";
  svgStack.appendChild(zoomControls);

  // Log-scale slider: 0 -> full buffer (1.0), 1 -> MIN_VIEW_WIDTH -- a
  // linear slider over view-width would spend almost its whole range on
  // zoom levels indistinguishable from "fully zoomed in."
  function sliderToViewWidth(sliderValue: number): number {
    return MIN_VIEW_WIDTH ** sliderValue;
  }
  function viewWidthToSlider(viewWidth: number): number {
    return Math.log(viewWidth) / Math.log(MIN_VIEW_WIDTH);
  }
  function syncZoomSlider(): void {
    zoomInput.value = String(viewWidthToSlider(viewEnd - viewStart));
  }

  function zoomAroundCenter(newViewWidth: number): void {
    const center = (viewStart + viewEnd) / 2;
    setView(center - newViewWidth / 2, center + newViewWidth / 2);
  }

  zoomInput.addEventListener("input", () => {
    zoomAroundCenter(sliderToViewWidth(Number(zoomInput.value)));
  });

  // Same step factor as wheel-to-zoom below, just centered on the current
  // view instead of the cursor -- buttons have no cursor position to zoom
  // toward.
  const ZOOM_STEP_FACTOR = 0.85;
  function stepZoom(factor: number): void {
    const currentViewWidth = viewEnd - viewStart;
    zoomAroundCenter(
      Math.max(MIN_VIEW_WIDTH, Math.min(1, currentViewWidth * factor)),
    );
    syncZoomSlider();
  }

  const zoomOutButton = document.createElement("button");
  zoomOutButton.type = "button";
  zoomOutButton.className = "zoomable-waveform-zoom-button";
  zoomOutButton.textContent = "−";
  zoomOutButton.setAttribute("aria-label", "Zoom out");
  zoomOutButton.addEventListener("click", () => {
    stepZoom(1 / ZOOM_STEP_FACTOR);
  });

  const zoomInButton = document.createElement("button");
  zoomInButton.type = "button";
  zoomInButton.className = "zoomable-waveform-zoom-button";
  zoomInButton.textContent = "+";
  zoomInButton.setAttribute("aria-label", "Zoom in");
  zoomInButton.addEventListener("click", () => {
    stepZoom(ZOOM_STEP_FACTOR);
  });

  zoomControls.append(zoomOutButton, zoomInButton);

  svg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      const localFraction = (event.clientX - bounds.left) / bounds.width;
      const currentViewWidth = viewEnd - viewStart;
      const cursorBufferPos = viewStart + localFraction * currentViewWidth;
      const zoomFactor = event.deltaY < 0 ? 0.85 : 1 / 0.85;
      const newViewWidth = Math.max(
        MIN_VIEW_WIDTH,
        Math.min(1, currentViewWidth * zoomFactor),
      );
      // Keeps the point under the cursor stationary while zooming, the
      // standard "zoom to cursor" feel.
      const newStart = cursorBufferPos - localFraction * newViewWidth;
      setView(newStart, newStart + newViewWidth);
      syncZoomSlider();
    },
    { passive: false },
  );

  return {
    setBuffer(newBuffer) {
      buffer = newBuffer;
      viewStart = 0;
      viewEnd = 1;
      zoomInput.value = "0";
      redrawWaveform();
      redrawHandles();
      redrawScrollbar();
    },
    getRange() {
      return { ...range };
    },
    setRange(newRange) {
      range.start = newRange.start;
      range.end = newRange.end;
      redrawHandles();
    },
    setLiveMarker(position) {
      liveMarkerPos = position;
      redrawHandles();
    },
  };
}
