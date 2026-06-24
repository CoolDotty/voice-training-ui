// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AnnotationsProvider,
  Region,
  useAnnotations,
} from "../src/annotations/AnnotationsProvider";
import { saveRecordingBundle } from "../src/services/recordingStore";
import type { Insight, Recording, RecordingDetail } from "../src/types";

describe("AnnotationsProvider local records", () => {
  it("loads local detail and renders stored rule insight", async () => {
    const recording: Recording = {
      id: 777,
      label: "Local component",
      note: "",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      audioBlobId: "audio-777",
      detailId: "detail-777",
      isLocal: true,
      duration_s: 2,
      pitch: {
        mean_hz: 168,
        median_hz: 168,
        min_hz: 150,
        max_hz: 190,
        range_hz: 40,
        sd_hz: 8,
      },
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
      register: {
        floor_hz: 130,
        in_register_pct: 95,
        semitones_sd: 2,
        in_register_semitones_sd: 2,
        onset_sub_pct: null,
        mid_sub_pct: null,
        offset_sub_pct: null,
        phrases_landed_pct: null,
        n_phrases: 0,
      },
    };
    const detail: RecordingDetail = {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 2,
      time_step: 0.01,
      frames: { t: [0, 0.01], hz: [168, 170] },
      phrases: [],
      summary: recording.register!,
    };
    const insight: Insight = {
      recordingId: recording.id,
      headline: "Stable browser take",
      summary: "The browser analyzer found a usable contour.",
      badges: ["Praat WASM"],
      primaryIssue: "usable contour",
      recommendedDrill: "Record one more take.",
      createdAt: "2026-06-24T00:00:00.000Z",
    };

    await saveRecordingBundle({
      recording,
      detail,
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      insight,
    });

    render(
      <AnnotationsProvider recording={recording}>
        <DetailProbe />
        <Region id="region.insights" />
      </AnnotationsProvider>,
    );

    expect(await screen.findByText("Stable browser take")).toBeTruthy();
    expect(await screen.findByText("detail:2")).toBeTruthy();
  });
});

function DetailProbe() {
  const { detail } = useAnnotations();
  return <span>{detail ? `detail:${detail.duration_s}` : "detail:loading"}</span>;
}
