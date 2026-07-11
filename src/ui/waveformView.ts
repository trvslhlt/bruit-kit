// Waveform preview + playhead scrubber, pairs with waveformView.css for
// styling. Draws a min/max-per-pixel SVG polygon (fast for long buffers —
// one point per horizontal pixel rather than one per sample) with a live
// playhead line and an optional "jitter band" overlay, and reports clicks
// as a 0..1 fraction of the buffer's duration rather than calling into any
// specific audio API — this module has no idea what a playhead click
// should *do*, that's entirely the caller's business via onSeek.

export interface WaveformViewOptions {
  width?: number;
  height?: number;
  /** Called with a 0..1 fraction when the waveform is clicked, e.g. to seek
   * a playhead. The view updates its own marker immediately regardless. */
  onSeek?: (fraction: number) => void;
}

export interface WaveformViewHandle {
  /** Draws a new buffer, resetting playhead/jitter-band state. */
  setBuffer(buffer: AudioBuffer): void;
  /** Moves the playhead marker to a 0..1 fraction of the buffer's duration. */
  setPlayheadFraction(fraction: number): void;
  /** Width (in ms) of the jitter-band overlay drawn around the playhead —
   * purely cosmetic, meant to visualize a "random position jitter" range if
   * the caller has one; pass 0 (the default) to hide it entirely. */
  setPositionJitterMs(ms: number): void;
}

export function createWaveformView(
  container: HTMLDivElement,
  options: WaveformViewOptions = {},
): WaveformViewHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 80;

  let bufferDuration = 0;
  let positionJitterMs = 0;
  let lastFraction = 0;
  let playheadLineEl: SVGLineElement | null = null;
  let jitterBandEl: SVGRectElement | null = null;

  function updatePlayheadVisual(fraction: number): void {
    if (!playheadLineEl || !jitterBandEl || bufferDuration <= 0) return;

    const x = fraction * width;
    playheadLineEl.setAttribute("x1", String(x));
    playheadLineEl.setAttribute("x2", String(x));

    const jitterFraction = positionJitterMs / 1000 / bufferDuration;
    const bandHalfWidth = jitterFraction * width;
    const bandX = Math.max(0, x - bandHalfWidth);
    const bandWidth = Math.min(width, x + bandHalfWidth) - bandX;
    jitterBandEl.setAttribute("x", String(bandX));
    jitterBandEl.setAttribute("width", String(Math.max(0, bandWidth)));
  }

  function setBuffer(buffer: AudioBuffer): void {
    container.innerHTML = "";
    bufferDuration = buffer.duration;
    lastFraction = 0;
    const data = buffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(data.length / width));

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "waveform-view");

    const mid = height / 2;
    const topPoints: string[] = [];
    const bottomPoints: string[] = [];

    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      let min = 0;
      let max = 0;
      for (let i = start; i < start + samplesPerPixel && i < data.length; i++) {
        const value = data[i];
        if (value > max) max = value;
        if (value < min) min = value;
      }
      topPoints.push(`${x},${mid - max * mid}`);
      bottomPoints.push(`${x},${mid - min * mid}`);
    }

    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    polygon.setAttribute(
      "points",
      [...topPoints, ...bottomPoints.reverse()].join(" "),
    );
    polygon.setAttribute("class", "waveform-fill");
    svg.appendChild(polygon);

    jitterBandEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    jitterBandEl.setAttribute("y", "0");
    jitterBandEl.setAttribute("height", String(height));
    jitterBandEl.setAttribute("class", "jitter-band");
    svg.appendChild(jitterBandEl);

    playheadLineEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    playheadLineEl.setAttribute("y1", "0");
    playheadLineEl.setAttribute("y2", String(height));
    playheadLineEl.setAttribute("class", "playhead-line");
    svg.appendChild(playheadLineEl);

    svg.addEventListener("click", (event) => {
      const bounds = svg.getBoundingClientRect();
      const fraction = Math.min(
        Math.max((event.clientX - bounds.left) / bounds.width, 0),
        1,
      );
      lastFraction = fraction;
      updatePlayheadVisual(fraction);
      options.onSeek?.(fraction);
    });

    container.appendChild(svg);
    updatePlayheadVisual(lastFraction);
  }

  return {
    setBuffer,
    setPlayheadFraction(fraction: number) {
      lastFraction = fraction;
      updatePlayheadVisual(fraction);
    },
    setPositionJitterMs(ms: number) {
      positionJitterMs = ms;
      updatePlayheadVisual(lastFraction);
    },
  };
}
