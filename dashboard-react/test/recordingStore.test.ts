import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  deleteLocalRecording,
  getAudioBlob,
  getInsight,
  getLocalRecordings,
  getRecordingDetail,
  getSetting,
  saveRecordingBundle,
  saveSetting,
  updateLocalRecordingMetadata,
} from "../src/services/recordingStore";
import type { Insight, Recording, RecordingDetail } from "../src/types";

describe("recordingStore", () => {
  it("saves, reads, and deletes a local recording bundle", async () => {
    const recording: Recording = {
      id: 501,
      label: "Store test",
      note: "local",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      audioBlobId: "audio-501",
      detailId: "detail-501",
      isLocal: true,
      duration_s: 1,
      pitch: {
        mean_hz: 170,
        median_hz: 170,
        min_hz: 160,
        max_hz: 180,
        range_hz: 20,
        sd_hz: 6,
      },
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
      register: {
        floor_hz: 130,
        in_register_pct: 100,
        semitones_sd: 1,
        in_register_semitones_sd: 1,
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
      duration_s: 1,
      time_step: 0.01,
      frames: { t: [0], hz: [170] },
      phrases: [],
      summary: recording.register!,
    };
    const insight: Insight = {
      recordingId: recording.id,
      headline: "Stable take",
      summary: "No urgent issue.",
      badges: ["Praat WASM"],
      primaryIssue: "none",
      recommendedDrill: "Record again.",
      createdAt: "2026-06-24T00:00:00.000Z",
    };

    await saveRecordingBundle({
      recording,
      detail,
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      insight,
    });

    expect(await getLocalRecordings()).toEqual([expect.objectContaining({ id: 501, isLocal: true })]);
    expect(await getRecordingDetail("detail-501")).toEqual(detail);
    expect(await getInsight(501)).toEqual(insight);
    expect(await getAudioBlob("audio-501")).toBeInstanceOf(Blob);

    await updateLocalRecordingMetadata(501, {
      label: "Edited label",
      note: "edited note",
    });
    expect(await getLocalRecordings()).toEqual([
      expect.objectContaining({
        id: 501,
        label: "Edited label",
        note: "edited note",
      }),
    ]);

    await saveSetting("registerFloor", 135);
    expect(await getSetting<number>("registerFloor")).toBe(135);

    await deleteLocalRecording(recording);
    expect(await getLocalRecordings()).toEqual([]);
    expect(await getRecordingDetail("detail-501")).toBeNull();
    expect(await getInsight(501)).toBeNull();
    expect(await getAudioBlob("audio-501")).toBeNull();
  });
});
