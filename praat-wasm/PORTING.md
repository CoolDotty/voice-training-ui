# Porting notes

## Goal

Ship a headless Praat-derived WebAssembly engine for Voice Garden. The browser
passes mono PCM into a worker and receives the same `Recording` and
`RecordingDetail` JSON shapes that `analyze.py` currently writes.

This package now has two analysis paths:

- `src/jsAnalyzer.js`: deterministic JavaScript fallback for browser UI/storage
  work.
- `src/praatWasmAnalyzer.js`: async loader for `dist/praat-voice-garden.js` that
  calls the compiled Praat wrapper and adapts its pitch JSON to Voice Garden's
  `Recording` / `RecordingDetail` shapes.

## Boundary

Keep these concerns outside the WASM module:

- microphone capture
- browser audio decoding
- blob storage
- labels, notes, dates, and ids
- React state

Keep these concerns inside the Praat wrapper once linked:

- Sound object creation from mono float PCM
- `To Pitch`
- `To Intensity`
- `To Formant (burg)`
- `To Harmonicity (cc)`
- `To PointProcess (periodic, cc)`
- jitter/shimmer calls
- spectrum/LTAS calls
- silence segmentation equivalent to `To TextGrid (silences)`

## Build strategy

1. Fetch Praat source with `npm run fetch:praat`.
2. Install and activate Emscripten. A local checkout under `vendor/emsdk` works
   and is ignored by git.
3. Run `npm run build:praat-libs -- --jobs=2` to compile the bounded Praat
   library set needed by the wrapper.
4. Run `npm run build:wasm` to link those libraries with
   `native/praat_voice_garden.cpp`. This emits `dist/praat-voice-garden.js` and
   `dist/praat-voice-garden.wasm`.
5. Run `npm run smoke:wasm` to verify a synthetic 180 Hz tone goes through real
   Praat `Sound_to_Pitch` and returns the Voice Garden result shape.
6. Run `npm run smoke:browser` to verify the browser `Worker` path loads the
   WASM module and returns the same result shape.
7. Use `npm run probe:praat-upstream -- --jobs=2` only as a diagnostic. It tries
   Praat's own makefiles with Emscripten and records the platform blockers.
8. Continue shrinking the library set toward a hand-minimal object list.

## Upstream build probe

The stock Praat makefiles can get surprisingly far under Emscripten:

```bash
npm run fetch:praat
npm run probe:praat-upstream -- --jobs=2
```

On Windows this needs GNU Make and Unix helpers such as `touch`/`rm`. The probe
script will use Git for Windows `usr/bin` and the WinGet `ezwinports.make`
location when present.

The first blocker found was `melder_audio.cpp` including `sys/soundcard.h`.
`PRAAT_AUDIO=none` is not enough for that path; the probe adds `CPPFLAGS=-DNO_AUDIO`.
With that define, Praat compiled through low-level dependencies and into `fon`.

Do not ship the stock top-level target as the first browser artifact. It pulls
in manual pages, editors, speech-recognition support, external codecs, and other
surface area that is unrelated to Voice Garden analysis. Treat the upstream
probe as a way to find compiler blockers, not as the production build path.

## Source landmarks

For the first Sound/Pitch proof, start here:

- `vendor/praat/fon/Sound.h` and `Sound.cpp`: create a mono `Sound` and fill
  `sound->z[1][i]` with PCM samples.
- `vendor/praat/fon/Sound_to_Pitch.h` and `Sound_to_Pitch.cpp`: call
  `Sound_to_Pitch(sound, timeStep, pitchFloor, pitchCeiling)` or
  `Sound_to_Pitch_rawAc(...)`.
- `vendor/praat/fon/Pitch.h` and `Pitch.cpp`: read `pitch->nx`, `pitch->dx`,
  `pitch->x1`, frame candidates, and summary helpers such as `Pitch_getMean`,
  `Pitch_getQuantile`, `Pitch_getMinimum`, `Pitch_getMaximum`, and
  `Pitch_getStandardDeviation`.

## Minimal target hypothesis

The first real build should avoid Praat's `main` target and should not compile
`foned`, `dwtools`, manual pages, editors, codecs, speech recognition, or the GUI
application bootstrap.

Start with these source groups:

- `kar`
- `melder`
- `sys`
- `dwsys`
- `fon`

`stat` may still be needed for headers or link symbols because `Pitch.h` includes
`Table.h`; treat it as optional until the first custom link pass proves whether
it is required.

Use the stock link order as the guide: higher-level `fon` first, then `dwsys`,
`sys`, `melder`, and `kar`.

For wrapper initialization, do not call `praat_init`; it initializes the desktop
application surface. Start with `MelderConsole_init()` and only add
`Melder_init()` if allocation, random, or audio-file initialization symbols are
actually needed by the pitch path.

Avoid pthreads in the first artifact. `Sound_to_Pitch` can pass through
`MelderThread_run`; force single-thread behavior with
`MelderThread_debugMultithreading(false, 1, 1, 1)` before analysis rather than
requiring `SharedArrayBuffer` and cross-origin isolation on day one.

The next size-reduction pass should try a hand-pruned object build. The smallest
likely Sound/Pitch surface is:

- `fon/Function.cpp`
- `fon/Sampled.cpp`
- `fon/SampledXY.cpp`
- `fon/Matrix.cpp`
- `fon/Vector.cpp`
- `fon/Sound.cpp`
- `fon/Sound_to_Pitch.cpp`
- `fon/Pitch.cpp` if using `Pitch_getMean` / quantile / min / max / SD helpers
- `dwsys/NUMFourier.cpp`
- `melder/NUM.cpp`
- `melder/NUMear.cpp`
- `melder/NUMinterpol.cpp`
- `melder/melder_sort.cpp`
- `sys/Thing.cpp`
- `sys/Data.cpp`
- `sys/Collection.cpp`

Likely traps from whole-object linking: `Pitch.cpp` pulls table/drawing helpers,
`Matrix.cpp` can reference formula/eigen paths, and `Sound_to_Pitch.cpp` contains
filtered variants that can pull spectrum conversion code. The current bounded
library build accepts this extra surface to keep the first Praat-backed artifact
working.

## First real proof

The first Praat-backed proof should only do duration and pitch contour. Do not
start with all metrics. First prove:

- WASM module loads in Node.
- PCM is copied into WASM correctly.
- Praat creates a `Sound`.
- Praat returns a pitch contour.
- Output matches the existing JS contract.

Current status: `npm run smoke:wasm` proves this in Node with a synthetic 180 Hz
tone. `npm run smoke:browser` verifies that `src/worker.js` can load the module
as a browser `Worker`, fetch `dist/praat-voice-garden.wasm`, transfer
`Float32Array` PCM, and return the Voice Garden-shaped result. Vite app workflow
integration is still required before treating the browser recording UI as
complete.

## Parity order

1. duration + pitch contour
2. pitch summary statistics
3. intensity summary and phrase segmentation
4. register/phrasing detail
5. formants
6. HNR, jitter, shimmer
7. LTAS/spectrum and corrected H1*-A3*

## Deployment constraints

Avoid pthreads for the first working build. If pthreads are enabled later, the
web app must be served with cross-origin isolation headers so `SharedArrayBuffer`
is available.

Do not rely on file paths for normal analysis. Emscripten MEMFS is useful for
temporary compatibility, but the desired public API is in-memory PCM in and JSON
out.
