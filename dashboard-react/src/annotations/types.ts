import type { ReactNode } from "react";
import type { Recording, RecordingDetail } from "../types";

// Context every slot render-fn receives.
export interface AnnotationCtx {
  recording: Recording;
  detail: RecordingDetail | null; // null while the heavy analysis loads
}

export type SlotFn = (ctx: AnnotationCtx) => ReactNode;

// One file per recording (src/annotations/entries/<NNN>.tsx) default-exports
// this. The agent fills in ONLY the slots it wants personalized for that take;
// every other spot falls back to the shared, data-driven default. This keeps
// per-recording content DRY: the page layout lives once, and only the bespoke
// bits are authored and persisted — so switching to an old recording brings its
// notes back without ever copy-pasting the whole page.
export interface RecordingAnnotations {
  slots?: Record<string, SlotFn>;
}
