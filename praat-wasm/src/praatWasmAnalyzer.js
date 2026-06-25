const PITCH_FLOOR = 75;
const PITCH_CEILING = 500;
const DEFAULT_REGISTER_FLOOR = 130;
const SEMITONE_REF = 100;
const MIN_RELIABLE_F3_HZ = 1800;
const MAX_RELIABLE_F3_HZ = 3400;
const MIN_F3_F2_GAP_HZ = 250;

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
  const intensityFrames = raw.pitch.frames.map((frame, i) => ({
    t: frames.t[i],
    db: clean(frame.intensity),
  }));
  const voicedHz = frames.hz.filter((hz) => hz != null);
  const pitch = {
    mean_hz: clean(raw.pitch.mean),
    median_hz: clean(raw.pitch.median),
    min_hz: clean(raw.pitch.min),
    max_hz: clean(raw.pitch.max),
    range_hz: clean(raw.pitch.max - raw.pitch.min),
    sd_hz: clean(raw.pitch.sd),
  };
  const formants = normalizeFormants(raw.formants);
  const phrases = segmentPhrases(frames, intensityFrames, registerFloor);
  const register = summarizeRegister(frames, phrases, registerFloor);
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
      formants,
      voice_quality: {
        hnr_db: clean(raw.voiceQuality?.hnr),
        jitter_pct: clean(raw.voiceQuality?.jitter),
        shimmer_pct: clean(raw.voiceQuality?.shimmer),
      },
      intensity: {
        mean_db: clean(raw.intensity?.mean),
        min_db: clean(raw.intensity?.min),
        max_db: clean(raw.intensity?.max),
      },
      register,
      weight: {
        h1a3c_db: clean(raw.weight?.h1a3c),
        h1a3_db: clean(raw.weight?.h1a3),
        tilt_db_khz: clean(raw.weight?.tilt),
      },
    },
    detail: {
      register_floor_hz: registerFloor,
      semitone_ref_hz: SEMITONE_REF,
      duration_s: clean(raw.duration),
      time_step: estimateTimeStep(frames.t),
      frames,
      phrases,
      summary: register,
    },
    diagnostics: {
      engine: "praat-wasm",
      sampleRate,
      samples: samples.length,
      unsupportedMetrics: [
        "weight.tilt_db_khz",
      ],
      elapsedMs: clean(performanceNow() - started),
    },
  };
}

export function normalizeFormants(rawFormants) {
  const f1 = clean(rawFormants?.f1);
  const f2 = clean(rawFormants?.f2);
  const f3 = clean(rawFormants?.f3);
  return {
    f1_hz: f1,
    f2_hz: f2,
    f3_hz: isReliableF3(f2, f3) ? f3 : null,
  };
}

function isReliableF3(f2, f3) {
  return (
    f2 != null &&
    f3 != null &&
    f3 >= MIN_RELIABLE_F3_HZ &&
    f3 <= MAX_RELIABLE_F3_HZ &&
    f3 - f2 >= MIN_F3_F2_GAP_HZ
  );
}

async function loadPraatModule() {
  if (!modulePromise) {
    const modulePath =
      globalThis.location?.origin
        ? `${globalThis.location.origin}/praat-wasm/praat-voice-garden.js`
        : "../dist/praat-voice-garden.js";
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

function segmentPhrases(frames, intensityFrames, floor) {
  const peak = Math.max(
    ...intensityFrames.map((frame) => (frame.db == null ? -Infinity : frame.db)),
  );
  if (!Number.isFinite(peak)) return [];

  const threshold = peak - 25;
  const sounding = intensityFrames.map((frame, i) => ({
    t: frame.t,
    sounding: frame.db != null && frame.db >= threshold && frames.hz[i] != null,
  }));
  const spans = [];
  let start = null;

  for (const frame of sounding) {
    if (frame.sounding && start == null) start = frame.t;
    if (!frame.sounding && start != null) {
      spans.push([start, frame.t]);
      start = null;
    }
  }
  if (start != null && sounding.length) {
    spans.push([start, sounding[sounding.length - 1].t]);
  }

  return spans
    .filter(([a, b]) => b - a >= 0.1)
    .map(([startTime, endTime]) => buildPhrase(frames, startTime, endTime, floor))
    .filter(Boolean);
}

function buildPhrase(frames, startTime, endTime, floor) {
  const voiced = [];
  for (let i = 0; i < frames.t.length; i += 1) {
    const hz = frames.hz[i];
    const t = frames.t[i];
    if (hz != null && t >= startTime && t <= endTime) voiced.push({ t, hz });
  }
  if (!voiced.length) return null;

  const onset = voiced.filter((point) => point.t - startTime <= 0.08);
  const offset = voiced.filter((point) => endTime - point.t <= 0.12);
  const onsetHz = mean((onset.length ? onset : [voiced[0]]).map((point) => point.hz));
  const offsetHz = mean((offset.length ? offset : [voiced[voiced.length - 1]]).map((point) => point.hz));
  const hzs = voiced.map((point) => point.hz);

  return {
    start: round(startTime, 3),
    end: round(endTime, 3),
    onset_hz: round(onsetHz, 1),
    offset_hz: round(offsetHz, 1),
    min_hz: round(Math.min(...hzs), 1),
    started_in_register: onsetHz >= floor,
    ended_in_register: offsetHz >= floor,
    sub_register_pct: round((100 * hzs.filter((hz) => hz < floor).length) / hzs.length, 1),
  };
}

function summarizeRegister(frames, phrases, registerFloor) {
  const voiced = [];
  for (let i = 0; i < frames.t.length; i += 1) {
    const hz = frames.hz[i];
    if (hz != null) voiced.push({ t: frames.t[i], hz });
  }
  const allHz = voiced.map((point) => point.hz);
  const inRegister = allHz.filter((hz) => hz >= registerFloor);
  const bins = {
    onset: [0, 0],
    mid: [0, 0],
    offset: [0, 0],
  };

  for (const phrase of phrases) {
    const duration = phrase.end - phrase.start || 1e-9;
    for (const point of voiced) {
      if (point.t < phrase.start || point.t > phrase.end) continue;
      const rel = (point.t - phrase.start) / duration;
      const key = rel < 1 / 3 ? "onset" : rel < 2 / 3 ? "mid" : "offset";
      bins[key][1] += 1;
      if (point.hz < registerFloor) bins[key][0] += 1;
    }
  }

  const landed = phrases.filter((phrase) => phrase.ended_in_register).length;

  return {
    floor_hz: clean(registerFloor),
    in_register_pct: allHz.length ? round((100 * inRegister.length) / allHz.length, 1) : null,
    semitones_sd: semitoneSd(allHz),
    in_register_semitones_sd: semitoneSd(inRegister),
    onset_sub_pct: pct(bins.onset),
    mid_sub_pct: pct(bins.mid),
    offset_sub_pct: pct(bins.offset),
    phrases_landed_pct: phrases.length ? Math.round((100 * landed) / phrases.length) : null,
    n_phrases: phrases.length,
  };
}

function semitoneSd(values) {
  if (values.length < 2) return null;
  const semitones = values.map((hz) => 12 * Math.log2(hz / SEMITONE_REF));
  const avg = mean(semitones);
  const variance =
    semitones.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (semitones.length - 1);
  return clean(Math.sqrt(variance));
}

function estimateTimeStep(times) {
  if (times.length < 2) return 0;
  return clean(times[1] - times[0]);
}

function pct(bin) {
  return bin[1] ? round((100 * bin[0]) / bin[1], 1) : null;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clean(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
