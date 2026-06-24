const PITCH_FLOOR = 75;
const PITCH_CEILING = 500;
const DEFAULT_REGISTER_FLOOR = 130;
const SEMITONE_REF = 100;
const TIME_STEP = 0.01;

export function analyzePcm(input) {
  const started = performanceNow();
  const samples = normalizeSamples(input.samples);
  const sampleRate = validateSampleRate(input.sampleRate);
  const registerFloor = Number.isFinite(input.registerFloor)
    ? Number(input.registerFloor)
    : DEFAULT_REGISTER_FLOOR;
  const duration = samples.length / sampleRate;
  const frames = pitchTrack(samples, sampleRate);
  const voicedHz = frames.hz.filter((hz) => hz != null);
  const intensityFrames = intensityTrack(samples, sampleRate, frames.t);
  const phrases = segmentPhrases(frames, intensityFrames, registerFloor);
  const register = summarizeRegister(frames, phrases, registerFloor);
  const pitch = summarizePitch(voicedHz);
  const intensity = summarizeIntensity(intensityFrames);
  const id = Number.isInteger(input.id) ? Number(input.id) : 0;
  const detailId = id > 0 ? `local-analysis-${id}` : "local-analysis-pending";

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
      duration_s: clean(duration),
      pitch,
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity,
      register,
    },
    detail: {
      register_floor_hz: registerFloor,
      semitone_ref_hz: SEMITONE_REF,
      duration_s: clean(duration),
      time_step: TIME_STEP,
      frames,
      phrases,
      summary: register,
    },
    diagnostics: {
      engine: "voice-garden-js-spike",
      sampleRate,
      samples: samples.length,
      unsupportedMetrics: [
        "formants.f1_hz",
        "formants.f2_hz",
        "formants.f3_hz",
        "voice_quality.hnr_db",
        "voice_quality.jitter_pct",
        "voice_quality.shimmer_pct",
        "weight.h1a3c_db",
        "weight.h1a3_db",
        "weight.tilt_db_khz",
      ],
      elapsedMs: clean(performanceNow() - started),
    },
  };
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

function pitchTrack(samples, sampleRate) {
  const frameStep = Math.max(1, Math.round(sampleRate * TIME_STEP));
  const frameSize = Math.max(256, Math.round(sampleRate * 0.04));
  const outT = [];
  const outHz = [];
  for (let start = 0; start + frameSize <= samples.length; start += frameStep) {
    const t = (start + frameSize / 2) / sampleRate;
    outT.push(round(t, 3));
    outHz.push(estimatePitch(samples, start, frameSize, sampleRate));
  }
  return { t: outT, hz: outHz };
}

function estimatePitch(samples, start, frameSize, sampleRate) {
  let mean = 0;
  let energy = 0;
  for (let i = 0; i < frameSize; i += 1) mean += samples[start + i];
  mean /= frameSize;
  for (let i = 0; i < frameSize; i += 1) {
    const v = samples[start + i] - mean;
    energy += v * v;
  }
  const rms = Math.sqrt(energy / frameSize);
  if (rms < 0.006) return null;

  const minLag = Math.floor(sampleRate / PITCH_CEILING);
  const maxLag = Math.ceil(sampleRate / PITCH_FLOOR);
  const correlations = [];

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let a = 0;
    let b = 0;
    let c = 0;
    const n = frameSize - lag;
    for (let i = 0; i < n; i += 1) {
      const x = samples[start + i] - mean;
      const y = samples[start + i + lag] - mean;
      a += x * y;
      b += x * x;
      c += y * y;
    }
    const corr = b > 0 && c > 0 ? a / Math.sqrt(b * c) : 0;
    correlations.push({ lag, corr });
  }

  let best = correlations.reduce(
    (winner, current) => (current.corr > winner.corr ? current : winner),
    { lag: 0, corr: 0 },
  );

  // For periodic signals, later harmonically-related lags can correlate nearly
  // as well as the real period. Prefer the first strong local peak to avoid
  // octave/subharmonic errors in the spike implementation.
  const strongEnough = best.corr * 0.88;
  for (let i = 1; i < correlations.length - 1; i += 1) {
    const prev = correlations[i - 1];
    const current = correlations[i];
    const next = correlations[i + 1];
    if (current.corr >= strongEnough && current.corr > prev.corr && current.corr >= next.corr) {
      best = current;
      break;
    }
  }

  if (best.corr < 0.45 || best.lag <= 0) return null;
  return round(sampleRate / best.lag, 1);
}

function intensityTrack(samples, sampleRate, times) {
  const frameSize = Math.max(256, Math.round(sampleRate * 0.03));
  return times.map((t) => {
    const center = Math.round(t * sampleRate);
    const start = Math.max(0, center - Math.floor(frameSize / 2));
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    return {
      t,
      db: rms > 0 ? round(20 * Math.log10(rms) + 100, 2) : null,
    };
  });
}

function segmentPhrases(frames, intensityFrames, floor) {
  const peak = Math.max(
    ...intensityFrames.map((f) => (f.db == null ? -Infinity : f.db)),
  );
  if (!Number.isFinite(peak)) return [];
  const threshold = peak - 25;
  const sounding = intensityFrames.map((f, i) => ({
    t: f.t,
    sounding: f.db != null && f.db >= threshold && frames.hz[i] != null,
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
  if (start != null && sounding.length) spans.push([start, sounding[sounding.length - 1].t]);

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
  const onset = voiced.filter((p) => p.t - startTime <= 0.08);
  const offset = voiced.filter((p) => endTime - p.t <= 0.12);
  const onsetHz = mean((onset.length ? onset : [voiced[0]]).map((p) => p.hz));
  const offsetHz = mean((offset.length ? offset : [voiced[voiced.length - 1]]).map((p) => p.hz));
  const hzs = voiced.map((p) => p.hz);
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

function summarizeRegister(frames, phrases, floor) {
  const voiced = [];
  for (let i = 0; i < frames.t.length; i += 1) {
    const hz = frames.hz[i];
    if (hz != null) voiced.push({ t: frames.t[i], hz });
  }
  const allHz = voiced.map((p) => p.hz);
  const inReg = allHz.filter((hz) => hz >= floor);
  const bins = {
    onset: [0, 0],
    mid: [0, 0],
    offset: [0, 0],
  };
  for (const phrase of phrases) {
    const dur = phrase.end - phrase.start || 1e-9;
    for (const point of voiced) {
      if (point.t < phrase.start || point.t > phrase.end) continue;
      const rel = (point.t - phrase.start) / dur;
      const key = rel < 1 / 3 ? "onset" : rel < 2 / 3 ? "mid" : "offset";
      bins[key][1] += 1;
      if (point.hz < floor) bins[key][0] += 1;
    }
  }
  const landed = phrases.filter((p) => p.ended_in_register).length;
  return {
    floor_hz: floor,
    in_register_pct: allHz.length ? round((100 * inReg.length) / allHz.length, 1) : null,
    semitones_sd: clean(sd(allHz.map((hz) => hzToSt(hz)))),
    in_register_semitones_sd: clean(sd(inReg.map((hz) => hzToSt(hz)))),
    onset_sub_pct: pct(bins.onset),
    mid_sub_pct: pct(bins.mid),
    offset_sub_pct: pct(bins.offset),
    phrases_landed_pct: phrases.length ? Math.round((100 * landed) / phrases.length) : null,
    n_phrases: phrases.length,
  };
}

function summarizePitch(values) {
  if (!values.length) {
    return {
      mean_hz: null,
      median_hz: null,
      min_hz: null,
      max_hz: null,
      range_hz: null,
      sd_hz: null,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return {
    mean_hz: clean(mean(values)),
    median_hz: clean(quantile(sorted, 0.5)),
    min_hz: clean(min),
    max_hz: clean(max),
    range_hz: clean(max - min),
    sd_hz: clean(sd(values)),
  };
}

function summarizeIntensity(frames) {
  const values = frames.map((f) => f.db).filter((db) => db != null);
  if (!values.length) return { mean_db: null, min_db: null, max_db: null };
  return {
    mean_db: clean(mean(values)),
    min_db: clean(Math.min(...values)),
    max_db: clean(Math.max(...values)),
  };
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] == null
    ? sorted[base]
    : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function pct(bin) {
  return bin[1] ? round((100 * bin[0]) / bin[1], 1) : null;
}

function hzToSt(hz) {
  return 12 * Math.log2(hz / SEMITONE_REF);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sd(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function clean(value) {
  return value == null || !Number.isFinite(value) ? null : round(value, 2);
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
