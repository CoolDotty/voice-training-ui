// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricModal } from "../src/components/MetricModal";
import { METRICS } from "../src/metrics";
import type { Recording } from "../src/types";

vi.mock("../src/components/WaveformPlayer", () => ({
  WaveformPlayer: ({
    src,
    audioBlobId,
    autoPlay,
  }: {
    src?: string | null;
    audioBlobId?: string | null;
    autoPlay?: boolean;
  }) => (
    <div
      data-testid="waveform-player"
      data-src={src ?? ""}
      data-audio-blob-id={audioBlobId ?? ""}
      data-auto-play={autoPlay ? "true" : "false"}
    />
  ),
}));

afterEach(() => cleanup());

describe("MetricModal", () => {
  it("plays local recording blobs from take dots", async () => {
    const recording: Recording = {
      id: 1,
      label: "Local take",
      note: "",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      audioBlobId: "audio-local-1",
      isLocal: true,
      duration_s: 1,
      pitch: {
        mean_hz: 172,
        median_hz: 172,
        min_hz: 160,
        max_hz: 185,
        range_hz: 25,
        sd_hz: 5,
      },
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
    };

    render(
      <MetricModal
        metric={METRICS.pitch}
        recordings={[recording]}
        references={[]}
        activeId={1}
        origin={null}
        onClose={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Play take #1/ }));

    expect(screen.getByTestId("waveform-player").dataset.audioBlobId).toBe(
      "audio-local-1",
    );
    expect(screen.getByTestId("waveform-player").dataset.autoPlay).toBe("true");
  });

  it("autoplays reference voice clips from reference ticks", async () => {
    render(
      <MetricModal
        metric={METRICS.pitch}
        recordings={[]}
        references={[
          {
            label: "VCTK f294",
            gender: "f",
            source: "test",
            audio: "reference-audio/vctk_f294.mp3",
            pitch: { mean_hz: 210, sd_hz: 18 },
            formants: { f2_hz: 1800, f3_hz: 2900 },
            intensity: { mean_db: 62 },
            voice_quality: { hnr_db: 12, jitter_pct: 0.8 },
            weight: { h1a3c_db: 8 },
          },
        ]}
        activeId={null}
        origin={null}
        onClose={() => undefined}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Play reference voice VCTK f294/ }),
    );

    const player = screen.getByTestId("waveform-player");
    expect(player.dataset.src).toBe("reference-audio/vctk_f294.mp3");
    expect(player.dataset.autoPlay).toBe("true");
  });
});
