const PITCH_FLOOR = 75;
const PITCH_CEILING = 500;
const DEFAULT_REGISTER_FLOOR = 130;
const SEMITONE_REF = 100;

let modulePromise;

export async function analyzePcmWithPraat(input) {
  const started = performanceNow();
  const samples = normalizeSamples(input.samples);
  const sampleRate = validateSampleRate(input.sampleRate);
  const registerFloor = Number.isFinite(input.registerFloor)
    ? Number(input.registerFloor)
    : DEFAULT_REGISTER_FLOOR;

  const module = await loadPraatModule();
  const raw = JSON.parse(module.analyzePcmJson(samples, sampleRate, PITCH_FLOOR, PITCH_CEILING));
  if (raw.error) {
    throw new Error(raw.error);
  }

  const frames = {
    t: raw.pitch.frames.map((frame) => clean(frame.time)),
    hz: raw.pitch.frames.map((frame) =>
      Number.isFinite(frame.frequency) && frame.frequency > 0 ? clean(frame.frequency) : null,
    ),
  };
  const voicedHz = frames.hz.filter((hz) => hz != null);
  const pitch = {
    mean_hz: clean(raw.pitch.mean),
    median_hz: clean(raw.pitch.median),
    min_hz: clean(raw.pitch.min),
    max_hz: clean(raw.pitch.max),
    range_hz: clean(raw.pitch.max - raw.pitch.min),
    sd_hz: clean(raw.pitch.sd),
  };
  const register = summarizeRegister(frames.hz, registerFloor);
  const id = Number.isInteger(input.id) ? Number(input.id) : 0;
  const detailId = id > 0 ? `praat-wasm-analysis-${id}` : "praat-wasm-analysis-pending";

  return {
    recording: {
      id,
      label: input.label || "Browser recording",
      note: input.note || "",
      date: input.date || new Date().toISOString().slice(0, 10),
      source_file: input.sourceFile || "browser-recording",
      audio: null,
      detail: undefined,
      detailId,
      duration_s: clean(raw.duration),
      pitch,
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
      register,
    },
    detail: {
      register_floor_hz: registerFloor,
      semitone_ref_hz: SEMITONE_REF,
      duration_s: clean(raw.duration),
      time_step: estimateTimeStep(frames.t),
      frames,
      phrases: [],
      summary: register,
    },
    diagnostics: {
      engine: "praat-wasm",
      sampleRate,
      samples: samples.length,
      unsupportedMetrics: [
        "formants.f1_hz",
        "formants.f2_hz",
        "formants.f3_hz",
        "voice_quality.hnr_db",
        "voice_quality.jitter_pct",
        "voice_quality.shimmer_pct",
        "intensity.mean_db",
        "intensity.min_db",
        "intensity.max_db",
        "phrases",
        "weight.h1a3c_db",
        "weight.h1a3_db",
        "weight.tilt_db_khz",
      ],
      elapsedMs: clean(performanceNow() - started),
    },
  };
}

async function loadPraatModule() {
  if (!modulePromise) {
    const modulePath = "../dist/praat-voice-garden.js";
    modulePromise = import(/* @vite-ignore */ modulePath).then((module) => module.default());
  }
  return modulePromise;
}

function normalizeSamples(samples) {
  if (samples instanceof Float32Array) return samples;
  if (Array.isArray(samples)) return Float32Array.from(samples);
  throw new TypeError("samples must be a Float32Array or number[]");
}

function validateSampleRate(sampleRate) {
  const sr = Number(sampleRate);
  if (!Number.isFinite(sr) || sr < 8000) {
    throw new TypeError("sampleRate must be a finite number >= 8000");
  }
  return sr;
}

function summarizeRegister(hzFrames, registerFloor) {
  const voiced = hzFrames.filter((hz) => hz != null);
  const inRegister = voiced.filter((hz) => hz >= registerFloor);

  return {
    floor_hz: clean(registerFloor),
    in_register_pct: voiced.length ? clean((inRegister.length / voiced.length) * 100) : null,
    semitones_sd: semitoneSd(voiced),
    in_register_semitones_sd: semitoneSd(inRegister),
    onset_sub_pct: null,
    mid_sub_pct: null,
    offset_sub_pct: null,
    phrases_landed_pct: null,
    n_phrases: 0,
  };
}

function semitoneSd(values) {
  if (values.length < 2) return null;
  const semitones = values.map((hz) => 12 * Math.log2(hz / SEMITONE_REF));
  const mean = semitones.reduce((sum, value) => sum + value, 0) / semitones.length;
  const variance = semitones.reduce((sum, value) => sum + (value - mean) ** 2, 0) / semitones.length;
  return clean(Math.sqrt(variance));
}

function estimateTimeStep(times) {
  if (times.length < 2) return 0;
  return clean(times[1] - times[0]);
}

function clean(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
