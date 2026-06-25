# Voice Garden

![HLdkXJnXwAAVpuS.jpg](HLdkXJnXwAAVpuS.jpg)

This is a cozy voice feminization tool that analyzes your voice in the browser and shows you metrics. I am not a professional, these metrics are my best understanding of what is useful and accurate but could be entirely wrong. Please use this as only one tool in your voice fem toolkit.

For best results, read the same passage with a similar microphone for all of your tests so they can be reliably compared.

## Usage

```sh
cd dashboard-react
npm install
npm run dev       # → http://localhost:5173
```

Record audio in-browser via your microphone. Analysis runs locally using either a real Praat WebAssembly build or a JavaScript fallback — everything stays on your machine. Recordings, analysis details, and auto-generated insights are then stored locally in IndexedDB.

```sh
npm run build     # production build → dist/
npm run preview   # serve the production build
```

## Praat WASM analysis

The `praat-wasm/` package provides a headless Praat WebAssembly build for browser-side voice analysis. It includes a JavaScript PCM fallback analyzer plus a real Praat WASM path that passes mono PCM through Praat's `Sound_to_Pitch`, formant, HNR, jitter/shimmer, and spectral-weight routines. Everything is exposed through a Web Worker with the same result shape consumed by the dashboard.

```sh
cd praat-wasm
npm run fetch:praat
npm run build:praat-libs -- --jobs=2
npm run build:wasm
npm test
npm run smoke:wasm
npm run smoke:browser
npm run bench -- 30
```

Generated Praat source, Emscripten SDK files, and WASM artifacts live under ignored `praat-wasm/vendor/` and `praat-wasm/dist/` paths. See `praat-wasm/PORTING.md` for the C++/Emscripten path and remaining parity work.

Pre-built WASM binaries are checked in at `dashboard-react/public/praat-wasm/` so the dashboard works out of the box.

## License

Voice Garden is licensed under the **GNU Affero General Public License, version 3 or later** (`AGPL-3.0-or-later`; see `LICENSE`).

This is explicit because Voice Garden includes a Praat-derived WebAssembly build path in `praat-wasm/`. Praat is GPLv3-or-later; AGPLv3-or-later is the project's stronger compatible copyleft choice so network-hosted versions keep the same source-sharing expectations.

## Credits & third-party assets

- **Reference voices** — the preview clips in `dashboard-react/public/reference-audio/` and the measured values in `reference.json` are derived from the **VCTK Corpus** (CSTR, University of Edinburgh — Veaux, Yamagishi & MacDonald), licensed **CC BY 4.0**. The clips were trimmed and transcoded. These files remain under **CC BY 4.0**. <https://datashare.ed.ac.uk/handle/10283/3443> · <https://creativecommons.org/licenses/by/4.0/>
- **Praat** (Boersma & Weenink), **GPLv3-or-later**, powers the WebAssembly analysis path.
- Other dependencies (React, Vite, wavesurfer.js, …) retain their own respective licenses.
