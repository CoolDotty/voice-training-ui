# Voice Garden - Multi-stage Docker build
#
# Stage 1: Build Praat WASM from source (Emscripten SDK)
# Stage 2: Build the React frontend (Node.js)
# Stage 3: Production runtime (Nginx)

# ─── Stage 1: WASM Builder ───────────────────────────────────────────────────
FROM emscripten/emsdk:latest AS wasm-builder
#   ships with emcc/em++/emmake, make, git, Node (≥18 needed for node:test)

WORKDIR /app

# Copy only the praat-wasm package source (no node_modules, no vendor/)
COPY praat-wasm/ ./praat-wasm/

# 1. Fetch Praat source (shallow clone into vendor/praat/)
RUN cd praat-wasm && npm run fetch:praat

# 2. Build Praat static libraries (clapack, gsl, num, kar, melder, sys,
#    dwsys, stat, fon) via emmake make -- takes several minutes
#
# Emscripten doesn't define __linux__/linux/UNIX by default, but Praat's
# platform detection relies on them.  These are already in build-wasm.mjs;
# propagate them to the library build so melder_files.cpp etc. compile.
ENV CPPFLAGS="-DUNIX -Dlinux -D__linux__ -DNO_GRAPHICS -DNO_GUI"
RUN cd praat-wasm && npm run build:praat-libs -- --jobs="$(nproc)"

# 3. Link the C++ wrapper against those libs → dist/praat-voice-garden.{js,wasm}
RUN cd praat-wasm && npm run build:wasm

# 4. Run unit tests (tests 1-4 JS fallback; test 5 real WASM integration)
#    and smoke test (validates synthetic tones through real Praat WASM)
RUN cd praat-wasm && npm test && npm run smoke:wasm

# ─── Stage 2: Frontend Builder ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy both packages so the file: dependency resolves correctly
COPY dashboard-react/ ./dashboard-react/
COPY praat-wasm/ ./praat-wasm/

# Replace the pre-built WASM binaries with our freshly built ones
COPY --from=wasm-builder \
  /app/praat-wasm/dist/praat-voice-garden.js \
  /app/dashboard-react/public/praat-wasm/praat-voice-garden.js
COPY --from=wasm-builder \
  /app/praat-wasm/dist/praat-voice-garden.wasm \
  /app/dashboard-react/public/praat-wasm/praat-voice-garden.wasm

# Install exact dependencies from lockfile
RUN cd dashboard-react && npm ci

# Run frontend unit tests (Vitest, jsdom, fake-indexeddb)
RUN cd dashboard-react && npm test

# Production build → dist/
RUN cd dashboard-react && npm run build

# ─── Stage 3: Production Runtime ─────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy production build
COPY --from=frontend-builder /app/dashboard-react/dist /usr/share/nginx/html

# Minimal nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
