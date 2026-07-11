// A second waveform widget, distinct from waveformView.ts's click-to-seek
// playhead scrubber: this one lets the user drag two handles to select a
// {start, end} sub-range (e.g. a sample playback trim range), rather than
// track a single moving position.

export interface WaveformRange {
  start: number;
  end: number;
}

export interface WaveformRangeViewOptions {
  width?: number;
  height?: number;
  initialRange?: WaveformRange;
  onChange?: (range: WaveformRange) => void;
}

export interface WaveformRangeViewHandle {
  setBuffer(buffer: AudioBuffer): void;
  getRange(): WaveformRange;
  setRange(range: WaveformRange): void;
}

export function createWaveformRangeView(
  container: HTMLDivElement,
  options: WaveformRangeViewOptions = {},
): WaveformRangeViewHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 80;
  const range: WaveformRange = {
    ...(options.initialRange ?? { start: 0, end: 1 }),
  };

  let redraw: (() => void) | null = null;

  function setBuffer(buffer: AudioBuffer): void {
    container.innerHTML = "";
    const midY = height / 2;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "waveform-range-svg");
    container.appendChild(svg);

    // One column per pixel of width: per-column min/max peak, drawn as a
    // filled top/bottom envelope — the standard "waveform view" shape.
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
    const waveformPolygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    waveformPolygon.setAttribute("class", "waveform-range-line");
    waveformPolygon.setAttribute(
      "points",
      [...topPoints, ...bottomPoints.reverse()].join(" "),
    );
    svg.appendChild(waveformPolygon);

    // Dims the excluded (not-selected) portion before the start handle and
    // after the end handle, so the selected range reads clearly at a glance.
    const beforeDim = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    const afterDim = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    for (const rect of [beforeDim, afterDim]) {
      rect.setAttribute("class", "waveform-range-dim");
      rect.setAttribute("y", "0");
      rect.setAttribute("height", String(height));
      svg.appendChild(rect);
    }

    redraw = () => {
      const x1 = range.start * width;
      const x2 = range.end * width;
      beforeDim.setAttribute("x", "0");
      beforeDim.setAttribute("width", String(x1));
      afterDim.setAttribute("x", String(x2));
      afterDim.setAttribute("width", String(width - x2));
      startHandle.setAttribute("x1", String(x1));
      startHandle.setAttribute("x2", String(x1));
      endHandle.setAttribute("x1", String(x2));
      endHandle.setAttribute("x2", String(x2));
    };

    function makeHandle(onDrag: (localX: number) => void): SVGLineElement {
      const handle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      handle.setAttribute("y1", "0");
      handle.setAttribute("y2", String(height));
      handle.classList.add("waveform-range-handle");
      svg.appendChild(handle);

      let dragging = false;
      handle.addEventListener("pointerdown", (event) => {
        dragging = true;
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const bounds = svg.getBoundingClientRect();
        const localX = ((event.clientX - bounds.left) / bounds.width) * width;
        onDrag(localX);
        redraw?.();
        options.onChange?.({ ...range });
      });
      handle.addEventListener("pointerup", () => {
        dragging = false;
      });
      return handle;
    }

    // Neither handle can cross the other.
    const startHandle = makeHandle((localX) => {
      const maxX = range.end * width;
      const clampedX = Math.min(maxX, Math.max(0, localX));
      range.start = clampedX / width;
    });
    const endHandle = makeHandle((localX) => {
      const minX = range.start * width;
      const clampedX = Math.min(width, Math.max(minX, localX));
      range.end = clampedX / width;
    });

    redraw();
  }

  return {
    setBuffer,
    getRange() {
      return { ...range };
    },
    setRange(newRange: WaveformRange) {
      range.start = newRange.start;
      range.end = newRange.end;
      redraw?.();
    },
  };
}
