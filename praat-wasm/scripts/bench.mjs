import { analyzePcmWithPraat } from "../src/index.js";

const sampleRate = 16000;
const durations = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const secondsList = durations.length ? durations : [30, 60, 180];

const results = [];

for (const seconds of secondsList) {
  const samples = new Float32Array(sampleRate * seconds);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = 0.25 * Math.sin((2 * Math.PI * 180 * i) / sampleRate);
  }

  const start = performance.now();
  const result = await analyzePcmWithPraat({
    samples,
    sampleRate,
    label: `${seconds}s 180 Hz sine`,
  });
  const elapsed = performance.now() - start;

  results.push({
    seconds,
    elapsedMs: Math.round(elapsed),
    duration_s: result.recording.duration_s,
    mean_hz: result.recording.pitch.mean_hz,
    frames: result.detail.frames.t.length,
    engine: result.diagnostics.engine,
  });
}

console.log(JSON.stringify(results, null, 2));
