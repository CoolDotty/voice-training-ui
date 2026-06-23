import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: './' so the production build can also be opened from the filesystem.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
