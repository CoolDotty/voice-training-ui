import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// base: './' so the production build can also be opened from the filesystem.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    fs: {
      allow: [here, resolve(here, "..", "praat-wasm")],
    },
  },
  worker: {
    format: "es",
  },
});
