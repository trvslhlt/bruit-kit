// A multi-point breakpoint-curve editor: drag points to reshape the curve,
// double-click empty space to add a point, double-click a point to remove
// it. Pairs with audio/automation.ts, which schedules a curve built here
// onto a real AudioParam over time — kept independent of it (this module
// has no Web Audio dependency at all) so the UI half stays usable for
// anything shaped like a 0..1 curve, not just audio automation.

export interface AutomationPoint {
  /** 0..1 position along the curve's timeline. */
  position: number;
  /** 0..1 value at that position. */
  value: number;
}

export interface AutomationEditorOptions {
  width?: number;
  height?: number;
  onChange?: (points: AutomationPoint[]) => void;
}

export interface AutomationEditorHandle {
  getPoints(): AutomationPoint[];
  setPoints(points: AutomationPoint[]): void;
}

/** The first and last points are permanent anchors (position pinned to
 * 0/1, draggable in value only) — everything between is free to add, drag,
 * or remove. `initialPoints` must have at least 2 points (a start and end);
 * they don't need to already be at position 0/1 — they're clamped there. */
export function createAutomationEditor(
  container: HTMLDivElement,
  initialPoints: AutomationPoint[],
  options: AutomationEditorOptions = {},
): AutomationEditorHandle {
  const width = options.width ?? 560;
  const height = options.height ?? 120;

  let points = clonePoints(initialPoints);
  points[0].position = 0;
  points[points.length - 1].position = 1;

  function clonePoints(source: AutomationPoint[]): AutomationPoint[] {
    return source.map((p) => ({ ...p }));
  }

  function render(): void {
    container.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Without this, the SVG's default "meet" scaling preserves the
    // viewBox's aspect ratio and letterboxes it inside a wider rendered
    // box, so screen coordinates no longer line up 1:1 with the viewBox
    // coordinates the pointer math below assumes.
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "automation-svg");
    container.appendChild(svg);

    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    polyline.setAttribute("class", "automation-line");
    svg.appendChild(polyline);

    const handles: SVGCircleElement[] = [];

    function redraw(): void {
      polyline.setAttribute(
        "points",
        points
          .map(
            (point) =>
              `${point.position * width},${height - point.value * height}`,
          )
          .join(" "),
      );
      points.forEach((point, index) => {
        handles[index].setAttribute("cx", String(point.position * width));
        handles[index].setAttribute(
          "cy",
          String(height - point.value * height),
        );
      });
    }

    // Adding a point is a structural change (a new handle needs its own
    // drag wiring keyed to its index among neighbors), so it's simplest to
    // rebuild the whole graph from the mutated points array rather than
    // patch one handle in.
    svg.addEventListener("dblclick", (event) => {
      const bounds = svg.getBoundingClientRect();
      const localX = ((event.clientX - bounds.left) / bounds.width) * width;
      const localY = ((event.clientY - bounds.top) / bounds.height) * height;
      const position = Math.min(1, Math.max(0, localX / width));
      const value = Math.min(1, Math.max(0, 1 - localY / height));
      const insertAt = points.findIndex((p) => p.position > position);
      points.splice(insertAt, 0, { position, value });
      options.onChange?.(clonePoints(points));
      render();
    });

    function makeHandle(index: number): SVGCircleElement {
      const isAnchor = index === 0 || index === points.length - 1;
      const handle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      handle.setAttribute("r", "5");
      handle.classList.add("automation-handle");
      if (isAnchor) handle.classList.add("automation-handle-anchor");
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
        const localY = ((event.clientY - bounds.top) / bounds.height) * height;
        const point = points[index];
        // Anchors can't move in X (position stays pinned to 0/1); interior
        // points are clamped between their immediate neighbors so the line
        // can't cross itself.
        if (!isAnchor) {
          const minX = points[index - 1].position * width;
          const maxX = points[index + 1].position * width;
          point.position = Math.min(maxX, Math.max(minX, localX)) / width;
        }
        point.value = 1 - Math.min(height, Math.max(0, localY)) / height;
        redraw();
        options.onChange?.(clonePoints(points));
      });
      handle.addEventListener("pointerup", () => {
        dragging = false;
      });
      // Anchors can't be removed — the curve always needs a defined
      // start/end value. stopPropagation so this dblclick doesn't also
      // bubble to the svg's own dblclick-to-add listener above.
      handle.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        if (isAnchor) return;
        points.splice(index, 1);
        options.onChange?.(clonePoints(points));
        render();
      });
      return handle;
    }

    points.forEach((_, index) => handles.push(makeHandle(index)));
    redraw();
  }

  render();

  return {
    getPoints() {
      return clonePoints(points);
    },
    setPoints(newPoints: AutomationPoint[]) {
      points = clonePoints(newPoints);
      points[0].position = 0;
      points[points.length - 1].position = 1;
      render();
    },
  };
}
