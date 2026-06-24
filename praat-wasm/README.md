# Praat WASM spike

This package is the browser-facing boundary for a headless Praat WebAssembly
build. It contains both a JavaScript fallback analyzer and a Praat-backed WASM
path for the first proven operation: mono PCM to Praat `Sound`, Praat
`Sound_to_Pitch`, pitch summary, and pitch frames.

## What works now

- `analyzePcm({ samples, sampleRate, label, note, registerFloor })`
- Duration, pitch contour, pitch summary, relative intensity, phrase splitting,
  and register detail from the JavaScript fallback.
- `analyzePcmWithPraat({ samples, sampleRate, label, note, registerFloor })`
  loads `dist/praat-voice-garden.js`, runs real Praat pitch analysis, and returns
  the existing Voice Garden `Recording` / `RecordingDetail` shape.
- A Web Worker entrypoint and a small client wrapper. The worker tries Praat WASM
  first and falls back to JavaScript if the WASM artifact is unavailable.
- Node tests, a synthetic benchmark, and a WASM smoke test.

## What is intentionally not done yet

- No upstream Praat source or Emscripten SDK is committed here; both live under
  ignored `vendor/` directories.
- The current Praat build uses Praat static libraries built from the vendored
  source. It is viable, but not yet size-pruned to the hand-minimal object list.
- Formants, intensity from Praat, phrase segmentation from Praat, HNR, jitter,
  shimmer, LTAS, and corrected H1*-A3* return `null` or fallback-only values
  until real Praat wrappers are wired in.

## Praat/Emscripten path

```sh
cd praat-wasm
npm run fetch:praat
npm run build:praat-libs -- --jobs=2
npm run build:wasm
npm run smoke:wasm
npm run smoke:browser
```

The generated WASM artifact is ignored at `dist/`. Distributing that artifact
means distributing a combined GPLv3 work because Praat is GPLv3-or-later.
