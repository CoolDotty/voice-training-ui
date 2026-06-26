# Voice Garden

![HLdkXJnXwAAVpuS.jpg](HLdkXJnXwAAVpuS.jpg)

This is a cozy voice feminization tool that analyzes your voice in the browser and shows you metrics. A WASM port of [Voice Garden](https://github.com/scratchyone/voice-training-ui).

For best results, read the same passage with a similar microphone for all of your tests so they can be reliably compared.

## Usage

Run the React dashboard locally:

```sh
cd dashboard-react
npm install
npm run dev
```

Open the Vite URL printed by the dev server, record a browser take, and review the generated pitch, resonance, phrase, and practice-focus cards in the UI. The analysis happens locally in the browser; no external agent-authored annotation step is required.

Build the dashboard for production:

```sh
npm run build     # production build → dist/
npm run preview   # serve the production build
```

### Docker

A multi-stage Docker build compiles Praat WASM from source, builds the frontend, and serves it behind Nginx.

```sh
# With docker compose (recommended)
docker compose up -d
# → http://localhost:8080

# With plain docker
docker build -t voice-garden .
docker run -p 8080:80 voice-garden
```

The build pipeline runs all unit tests and the WASM smoke test inside the container.

## Browser-only analysis

The `praat-wasm/` package defines the browser-side analysis boundary for a headless Praat WebAssembly build. It includes a JavaScript PCM fallback analyzer plus a Praat WASM wrapper for mono PCM analysis, exposed through the worker and result shapes the dashboard consumes.

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

This is explicit because Voice Garden uses **Praat** through a Praat-derived WebAssembly build path in `praat-wasm/`. Praat is GPLv3-or-later; AGPLv3-or-later is the project's stronger compatible copyleft choice so network-hosted versions keep the same source-sharing expectations.

## Credits & third-party assets

- **Reference voices** — the preview clips in `dashboard-react/public/reference-audio/` and the measured values in `reference.json` are derived from the **VCTK Corpus** (CSTR, University of Edinburgh — Veaux, Yamagishi & MacDonald), licensed **CC BY 4.0**. The clips were trimmed and transcoded. These files remain under **CC BY 4.0**. <https://datashare.ed.ac.uk/handle/10283/3443> · <https://creativecommons.org/licenses/by/4.0/>
- **Praat** (Boersma & Weenink), **GPLv3-or-later**, powers the WebAssembly analysis path.
- Other dependencies (React, Vite, wavesurfer.js, and others) retain their own respective licenses.
