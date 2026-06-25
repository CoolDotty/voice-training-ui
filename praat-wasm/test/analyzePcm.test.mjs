import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { analyzePcm, analyzePcmWithPraat } from "../src/index.js";
import { normalizeFormants } from "../src/praatWasmAnalyzer.js";

function sine({ hz, seconds = 1, sampleRate = 44100, amp = 0.3 }) {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = amp * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  }
  return { samples, sampleRate };
}

test("analyzePcm reports duration and pitch for a simple voiced clip", () => {
  const input = sine({ hz: 180, seconds: 1.2 });
  const result = analyzePcm({ ...input, label: "test", registerFloor: 130 });

  assert.equal(result.recording.label, "test");
  assert.ok(Math.abs(result.recording.duration_s - 1.2) < 0.02);
  assert.ok(Math.abs(result.recording.pitch.mean_hz - 180) < 3);
  assert.ok(result.detail.frames.t.length > 80);
  assert.equal(result.recording.register.in_register_pct, 100);
  assert.equal(result.diagnostics.engine, "voice-garden-js-spike");
});

test("analyzePcm marks unsupported Praat-grade metrics as null", () => {
  const input = sine({ hz: 160 });
  const result = analyzePcm(input);

  assert.equal(result.recording.formants.f1_hz, null);
  assert.equal(result.recording.voice_quality.hnr_db, null);
  assert.ok(result.diagnostics.unsupportedMetrics.includes("formants.f2_hz"));
});

test("normalizeFormants drops suspicious F3 while keeping F1 and F2", () => {
  assert.deepEqual(normalizeFormants({ f1: 650, f2: 1800, f3: 2900 }), {
    f1_hz: 650,
    f2_hz: 1800,
    f3_hz: 2900,
  });

  assert.deepEqual(normalizeFormants({ f1: 650, f2: 1800, f3: 3465 }), {
    f1_hz: 650,
    f2_hz: 1800,
    f3_hz: null,
  });

  assert.deepEqual(normalizeFormants({ f1: 650, f2: 2500, f3: 2600 }), {
    f1_hz: 650,
    f2_hz: 2500,
    f3_hz: null,
  });
});

test("analyzePcm reports sub-register time", () => {
  const sampleRate = 44100;
  const samples = new Float32Array(sampleRate * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const hz = i < sampleRate ? 180 : 110;
    samples[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  }

  const result = analyzePcm({ samples, sampleRate, registerFloor: 130 });

  assert.ok(result.recording.register.in_register_pct < 70);
  assert.ok(result.recording.register.in_register_pct > 30);
  assert.ok(result.detail.phrases.length >= 1);
});

test("analyzePcm segments phrases and summarizes register-position bins", () => {
  const input = phraseLandingClip();
  const result = analyzePcm({ ...input, registerFloor: 130 });
  const { register } = result.recording;

  assert.equal(result.detail.phrases.length, 2);
  assert.equal(register.n_phrases, 2);
  assert.equal(register.phrases_landed_pct, 50);
  assert.equal(result.detail.summary.n_phrases, register.n_phrases);
  assert.ok(Number.isFinite(register.onset_sub_pct));
  assert.ok(Number.isFinite(register.mid_sub_pct));
  assert.ok(Number.isFinite(register.offset_sub_pct));
  assert.ok(register.offset_sub_pct > register.onset_sub_pct);

  const [landed, dropped] = result.detail.phrases;
  assert.equal(landed.started_in_register, true);
  assert.equal(landed.ended_in_register, true);
  assert.equal(dropped.started_in_register, true);
  assert.equal(dropped.ended_in_register, false);
  assert.ok(dropped.sub_register_pct > landed.sub_register_pct);
});

test(
  "analyzePcmWithPraat segments phrases and supports phrase diagnostics",
  { skip: hasPraatDist() ? false : "requires built praat-wasm/dist artifact" },
  async () => {
    const input = phraseLandingClip({ sampleRate: 16000 });
    const result = await analyzePcmWithPraat({ ...input, registerFloor: 130 });
    const { register } = result.recording;

    assert.equal(result.diagnostics.engine, "praat-wasm");
    assert.equal(result.diagnostics.unsupportedMetrics.includes("phrases"), false);
    assert.equal(result.detail.phrases.length, register.n_phrases);
    assert.equal(register.n_phrases, 2);
    assert.equal(register.phrases_landed_pct, 50);
    assert.ok(Number.isFinite(register.onset_sub_pct));
    assert.ok(Number.isFinite(register.mid_sub_pct));
    assert.ok(Number.isFinite(register.offset_sub_pct));
    assert.ok(register.offset_sub_pct > register.onset_sub_pct);
  },
);

function phraseLandingClip({ sampleRate = 44100 } = {}) {
  return concatSegments(
    [
      { hz: 180, seconds: 0.5, amp: 0.3 },
      { seconds: 0.24, amp: 0 },
      { startHz: 180, endHz: 110, seconds: 0.52, amp: 0.3 },
    ],
    sampleRate,
  );
}

function concatSegments(segments, sampleRate) {
  const length = segments.reduce((sum, segment) => sum + Math.round(segment.seconds * sampleRate), 0);
  const samples = new Float32Array(length);
  let offset = 0;
  let phase = 0;

  for (const segment of segments) {
    const segmentLength = Math.round(segment.seconds * sampleRate);
    const amp = segment.amp ?? 0.3;
    const startHz = segment.startHz ?? segment.hz ?? 0;
    const endHz = segment.endHz ?? startHz;
    for (let i = 0; i < segmentLength; i += 1) {
      const fraction = segmentLength > 1 ? i / (segmentLength - 1) : 0;
      const hz = startHz + (endHz - startHz) * fraction;
      samples[offset + i] = hz > 0 && amp > 0 ? amp * Math.sin(phase) : 0;
      phase += hz > 0 ? (2 * Math.PI * hz) / sampleRate : 0;
    }
    offset += segmentLength;
  }

  return { samples, sampleRate };
}

function hasPraatDist() {
  return existsSync(new URL("../dist/praat-voice-garden.js", import.meta.url));
}
