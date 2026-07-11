import { type ArpParams, buildArpSequence, pickStep } from "./arpPatterns";
import { CHORD_SHAPES, type ChordShapeName } from "./chordShapes";
import type { NoteEvent } from "./noteTarget";

/** A note with its fixed start/end already known — the piece of information
 * a live key press doesn't have until it's released, which is what lets
 * these run as one-shot preprocessing transforms instead of live scheduling. */
export interface NoteInterval {
  start: number;
  end: number;
  note: number;
  velocity: number;
}

export interface ChordParams {
  enabled: boolean;
  shape: ChordShapeName;
}

export interface FileArpParams extends ArpParams {
  enabled: boolean;
}

/** Same voicing table as the live ChordEffect, applied to every interval at
 * once instead of one call at a time. */
export function applyChordToIntervals(
  intervals: NoteInterval[],
  params: ChordParams,
): NoteInterval[] {
  if (!params.enabled) return intervals;
  const offsets = CHORD_SHAPES[params.shape];
  const result: NoteInterval[] = [];
  for (const iv of intervals) {
    for (const offset of offsets)
      result.push({ ...iv, note: iv.note + offset });
  }
  return result;
}

function clusterOverlapping(intervals: NoteInterval[]): NoteInterval[][] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const clusters: NoteInterval[][] = [];
  let current: NoteInterval[] = [];
  let currentEnd = Number.NEGATIVE_INFINITY;
  for (const iv of sorted) {
    if (current.length > 0 && iv.start < currentEnd) {
      current.push(iv);
      currentEnd = Math.max(currentEnd, iv.end);
    } else {
      if (current.length > 0) clusters.push(current);
      current = [iv];
      currentEnd = iv.end;
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

/** Replaces each cluster of time-overlapping notes (a chord — whether from
 * the file itself, or synthesized a moment ago by applyChordToIntervals)
 * with a stepped sequence spanning the cluster's combined duration. This is
 * the file-playback equivalent of ArpeggiatorEffect, made possible by
 * already knowing each note's fixed start/end upfront: a lone melody note
 * with nothing overlapping it becomes a one-note "cluster" and just gets
 * retriggered at the arp rate for its own duration (a trill) — the same
 * thing a real arpeggiator does when you play it a single note. */
export function applyArpToIntervals(
  intervals: NoteInterval[],
  params: FileArpParams,
): NoteInterval[] {
  if (!params.enabled) return intervals;
  const stepSeconds = 1 / Math.max(params.rateHz, 0.1);
  const result: NoteInterval[] = [];

  for (const cluster of clusterOverlapping(intervals)) {
    const start = Math.min(...cluster.map((iv) => iv.start));
    const end = Math.max(...cluster.map((iv) => iv.end));
    const uniqueByNote = new Map<number, number>();
    for (const iv of cluster) {
      if (!uniqueByNote.has(iv.note)) uniqueByNote.set(iv.note, iv.velocity);
    }
    const held = [...uniqueByNote.entries()].map(([note, velocity]) => ({
      note,
      velocity,
    }));
    const sequence = buildArpSequence(held, params.pattern, params.octaves);
    if (sequence.length === 0) continue;

    let stepIndex = 0;
    for (let t = start; t < end; t += stepSeconds) {
      const step = pickStep(sequence, params.pattern, stepIndex);
      if (!step) break;
      if (params.pattern !== "random") stepIndex++;
      const gateEnd = Math.min(t + stepSeconds * params.gate, end);
      result.push({
        start: t,
        end: gateEnd,
        note: step.note,
        velocity: step.velocity,
      });
    }
  }
  return result;
}

export function intervalsToNoteEvents(intervals: NoteInterval[]): NoteEvent[] {
  const events: NoteEvent[] = [];
  for (const iv of intervals) {
    events.push({
      time: iv.start,
      type: "noteOn",
      note: iv.note,
      velocity: iv.velocity,
    });
    events.push({ time: iv.end, type: "noteOff", note: iv.note });
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}
