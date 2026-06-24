import createPraatModule from "../dist/praat-voice-garden.js";
import { analyzePcmWithPraat } from "../src/praatWasmAnalyzer.js";

const sampleRate = Number(process.argv[2] || 16_000);
const frequency = Number(process.argv[3] || 180);
const durationSeconds = Number(process.argv[4] || 1);
const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
const samples = new Float32Array(sampleCount);

for (let i = 0; i < sampleCount; i += 1) {
  samples[i] = 0.2 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
}

const module = await createPraatModule();
const raw = module.analyzePcmJson(samples, sampleRate, 75, 500);
const result = JSON.parse(raw);

if (result.error) {
  throw new Error(result.error);
}

const summary = {
  engine: result.engine,
  sampleRate: result.sampleRate,
  duration: result.duration,
  expectedFrequency: frequency,
  meanPitch: result.pitch.mean,
  medianPitch: result.pitch.median,
  voicedFrames: result.pitch.voicedFrames,
  frameCount: result.pitch.frames.length,
};

console.log(JSON.stringify(summary, null, 2));

if (Math.abs(result.pitch.mean - frequency) > 2) {
  throw new Error(`Mean pitch ${result.pitch.mean} is not close to expected ${frequency}`);
}

if (result.pitch.voicedFrames <= 0 || result.pitch.frames.length <= 0) {
  throw new Error("Expected voiced pitch frames");
}

const shaped = await analyzePcmWithPraat({ samples, sampleRate, registerFloor: 130 });
console.log(
  JSON.stringify(
    {
      shapedEngine: shaped.diagnostics.engine,
      shapedMeanPitch: shaped.recording.pitch.mean_hz,
      shapedFrameCount: shaped.detail.frames.t.length,
      shapedInRegisterPct: shaped.recording.register.in_register_pct,
    },
    null,
    2,
  ),
);

if (shaped.diagnostics.engine !== "praat-wasm") {
  throw new Error(`Expected praat-wasm shaped engine, got ${shaped.diagnostics.engine}`);
}

if (Math.abs(shaped.recording.pitch.mean_hz - frequency) > 2) {
  throw new Error(`Shaped mean pitch ${shaped.recording.pitch.mean_hz} is not close to expected ${frequency}`);
}
