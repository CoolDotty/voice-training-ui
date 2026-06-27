// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordingPanel } from "../src/components/RecordingPanel";
import {
  EXERCISE_LIBRARY,
  PRESET_EXERCISE_CATEGORY_IDS,
} from "../src/data/exerciseLibrary";
import type { AnalyzePcmResult } from "../src/services/analysisWorkerClient";

let pendingAnalysis: {
  promise: Promise<never>;
  reject: (error: Error) => void;
};

const analyzeMock = vi.fn();
const terminateMock = vi.fn(() => {
  pendingAnalysis.reject(new Error("Analysis cancelled"));
});
const settingsStore = new Map<string, unknown>();

vi.mock("../src/services/analysisWorkerClient", () => ({
  createAnalysisWorkerClient: () => ({
    analyze: analyzeMock,
    terminate: terminateMock,
  }),
}));

vi.mock("../src/services/recordingStore", () => ({
  getSetting: vi.fn((key: string) => Promise.resolve(settingsStore.get(key) ?? null)),
  saveRecordingBundle: vi.fn(() => Promise.resolve()),
  saveSetting: vi.fn((key: string, value: unknown) => {
    settingsStore.set(key, value);
    return Promise.resolve();
  }),
}));

describe("RecordingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.clear();
    pendingAnalysis = createPendingAnalysis();
    analyzeMock.mockReturnValue(pendingAnalysis.promise);
    installMediaMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders low-friction metadata fields and register floor presets", async () => {
    render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    expect(screen.getByDisplayValue("New Recording (10)")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Exercise" }).textContent).toContain(
      "Daily Check-In",
    );
    await openSelect("Exercise");
    expect(screen.getByRole("option", { name: /Phrase Endings/ })).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: /Practice landing the last words without dropping too low/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Random prompt pool")).toBeNull();
    await chooseOption(/Daily Check-In/);
    expect(
      screen.getByRole("link", { name: /Learn why: Getting Started/ }).getAttribute("href"),
    ).toBe(
      "https://wiki.sumianvoice.com/wiki/pages/getting-started/",
    );
    expect(screen.getByRole("button", { name: "Reroll exercise" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Register floor" }).textContent).toContain(
      "Beginner (130 Hz)",
    );
    await openSelect("Register floor");
    expect(screen.getByRole("option", { name: /Hard \(165 Hz\)/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Other \(custom\)/ })).toBeTruthy();
    await chooseOption(/Beginner \(130 Hz\)/);
    expect(screen.queryByRole("spinbutton")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Reroll exercise" }));

    await selectValue("Exercise", /Phrase Endings/);
    expect(
      screen.getByRole("link", { name: /Learn why: Base Pitch/ }).getAttribute("href"),
    ).toBe(
      "https://wiki.sumianvoice.com/wiki/pages/PIPM/basepitch.html",
    );

    await selectValue("Exercise", /Custom/);
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Custom exercise text" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Learn why:/ })).toBeNull();

    await selectValue("Register floor", /Other \(custom\)/);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("130");

    expect(screen.queryByText("Optional note")).toBeNull();
    expect(screen.getByText(/Pitch frames below this threshold/)).toBeTruthy();
  });

  it("has 100 generated exercises for each preset category", () => {
    for (const categoryId of PRESET_EXERCISE_CATEGORY_IDS) {
      expect(EXERCISE_LIBRARY[categoryId]).toHaveLength(100);
    }
  });

  it("preserves the selected exercise across remounts", async () => {
    const { unmount } = render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    await selectValue("Exercise", /Phrase Endings/);
    expect(screen.getByRole("combobox", { name: "Exercise" }).textContent).toContain(
      "Phrase Endings",
    );
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();
    await waitFor(() =>
      expect(settingsStore.get("exercisePicker")).toMatchObject({
        categoryId: "phrase-endings",
      }),
    );

    unmount();
    render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Exercise" }).textContent).toContain(
        "Phrase Endings",
      ),
    );
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();
  });

  it("saves without adding last-used exercise chips", async () => {
    analyzeMock.mockResolvedValueOnce(makeAnalyzeResult());
    terminateMock.mockImplementationOnce(() => undefined);
    const { unmount } = render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    await selectValue("Exercise", /Phrase Endings/);
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await userEvent.click(await screen.findByRole("button", { name: "Save take" }));
    expect(await screen.findByText("Saved with praat-wasm")).toBeTruthy();
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();
    await waitFor(() =>
      expect(settingsStore.get("exercisePicker")).toMatchObject({
        categoryId: "phrase-endings",
      }),
    );

    unmount();
    render(<RecordingPanel nextId={11} onSaved={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Exercise" }).textContent).toContain(
        "Phrase Endings",
      ),
    );
    expect(screen.queryByLabelText("Previous exercises")).toBeNull();
  });

  it("renders the upload button alongside the record button", () => {
    render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    expect(screen.getByRole("button", { name: "Start recording" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload recording" })).toBeTruthy();
    expect(screen.getByLabelText("Upload audio file")).toBeTruthy();
  });

  it("accepts an uploaded audio file and reaches ready state", async () => {
    render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    const file = new File(["dummy"], "my-voice.wav", { type: "audio/wav" });
    const input = screen.getByLabelText("Upload audio file") as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(await screen.findByRole("button", { name: "Save take" })).toBeTruthy();
    expect(screen.getByText("my-voice.wav")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeTruthy();
  });

  it("records, reaches ready state, starts analysis, and supports cancellation", async () => {
    render(<RecordingPanel nextId={10} onSaved={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(await screen.findByRole("button", { name: "Save take" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Save take" }));
    expect(await screen.findByRole("button", { name: "Cancel analysis" })).toBeTruthy();
    expect(analyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "New Recording (10)",
        note: expect.stringMatching(/^Exercise: Daily Check-In - /),
        registerFloor: 130,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(await screen.findByText("Analysis cancelled")).toBeTruthy();
    expect(terminateMock).toHaveBeenCalled();
  });
});

async function openSelect(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name }));
}

async function chooseOption(name: RegExp) {
  await userEvent.click(screen.getByRole("option", { name }));
}

async function selectValue(name: string, optionName: RegExp) {
  await openSelect(name);
  await chooseOption(optionName);
}

function createPendingAnalysis() {
  let reject!: (error: Error) => void;
  const promise = new Promise<never>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

function installMediaMocks() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() =>
        Promise.resolve({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      ),
    },
  });
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: MockAudioContext,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:recording"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

class MockMediaRecorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

class MockAudioContext {
  createAnalyser() {
    return {
      fftSize: 512,
      getByteTimeDomainData(values: Uint8Array) {
        values.fill(128);
      },
    };
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    };
  }

  decodeAudioData() {
    return Promise.resolve({
      length: 2,
      sampleRate: 16000,
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([0, 0]),
    });
  }

  close() {
    return Promise.resolve();
  }
}

function makeAnalyzeResult(): AnalyzePcmResult {
  return {
    recording: {
      id: 10,
      label: "New Recording (10)",
      note: "",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      duration_s: 1,
      pitch: {
        mean_hz: 170,
        median_hz: 170,
        min_hz: 160,
        max_hz: 180,
        range_hz: 20,
        sd_hz: 4,
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
    },
    detail: {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 1,
      time_step: 0.01,
      frames: { t: [0], hz: [170] },
      phrases: [],
      summary: {
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
    },
    diagnostics: {
      engine: "praat-wasm",
      sampleRate: 16000,
      samples: 16000,
      unsupportedMetrics: [],
      elapsedMs: 1,
    },
  };
}
