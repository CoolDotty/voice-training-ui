import { describe, expect, it } from "vitest";
import { createRuleInsight } from "../src/services/insightRules";
import type { Recording, RecordingDetail } from "../src/types";
import type { AnalyzeDiagnostics } from "../src/services/analysisWorkerClient";

describe("createRuleInsight", () => {
  it("prioritizes pitch, melody, register, and unsupported metric badges", () => {
    const recording: Recording = {
      id: 42,
      label: "Fixture",
      note: "",
      date: "2026-06-24",
      source_file: "fixture",
      audio: null,
      duration_s: 4,
      pitch: {
        mean_hz: 150,
        median_hz: 150,
        min_hz: 120,
        max_hz: 180,
        range_hz: 60,
        sd_hz: 8,
      },
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
      register: {
        floor_hz: 130,
        in_register_pct: 62,
        semitones_sd: 1.8,
        in_register_semitones_sd: 1.6,
        onset_sub_pct: null,
        mid_sub_pct: null,
        offset_sub_pct: null,
        phrases_landed_pct: 50,
        n_phrases: 2,
      },
    };
    const detail: RecordingDetail = {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 4,
      time_step: 0.01,
      frames: { t: [0, 0.01, 0.02], hz: [140, null, 155] },
      phrases: [],
      summary: recording.register!,
    };
    const diagnostics: AnalyzeDiagnostics = {
      engine: "praat-wasm",
      sampleRate: 48000,
      samples: 192000,
      unsupportedMetrics: ["formants.f1_hz"],
      elapsedMs: 12,
    };

    const insight = createRuleInsight(recording, detail, diagnostics);

    expect(insight.recordingId).toBe(42);
    expect(insight.headline).toBe("Next practice focus");
    expect(insight.primaryIssue).toContain("average pitch");
    expect(insight.summary).toContain("150 Hz average pitch");
    expect(insight.badges).toContain("Praat WASM");
    expect(insight.badges).toContain("pitch lift");
    expect(insight.recommendedDrill).toContain("slightly higher");
  });
});
