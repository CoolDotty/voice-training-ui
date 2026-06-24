import assert from "node:assert/strict";
import test from "node:test";
import { analyzePcm } from "../src/index.js";

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

