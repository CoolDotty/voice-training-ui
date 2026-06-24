import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const praatRoot = resolve(root, "vendor", "praat");
const outDir = resolve(root, "dist");
const wrapper = resolve(root, "native", "praat_voice_garden.cpp");
const praatLibs = [
  resolve(praatRoot, "fon", "libfon.a"),
  resolve(praatRoot, "dwsys", "libdwsys.a"),
  resolve(praatRoot, "stat", "libstat.a"),
  resolve(praatRoot, "sys", "libsys.a"),
  resolve(praatRoot, "melder", "libmelder.a"),
  resolve(praatRoot, "kar", "libkar.a"),
  resolve(praatRoot, "external", "gsl", "libgsl.a"),
  resolve(praatRoot, "external", "clapack", "libclapack.a"),
  resolve(praatRoot, "external", "num", "libnum.a"),
];

if (!existsSync(praatRoot)) {
  console.error("Missing vendor/praat. Run `npm run fetch:praat` first.");
  process.exit(1);
}

const emcc = spawnSync("emcc", ["--version"], { encoding: "utf8" });
if (emcc.status !== 0) {
  console.error("Missing emcc. Install and activate Emscripten before build:wasm.");
  process.exit(1);
}

const missingLibs = praatLibs.filter((path) => !existsSync(path));
if (missingLibs.length > 0) {
  console.error("Missing Praat static libraries. Run `npm run build:praat-libs -- --jobs=2` first.");
  for (const path of missingLibs) {
    console.error(" ", path);
  }
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const outJs = resolve(outDir, "praat-voice-garden.js");
const result = spawnSync(
  "em++",
  [
    wrapper,
    "-std=c++17",
    "-DUNIX",
    "-Dlinux",
    "-DNO_GRAPHICS",
    "-DNO_GUI",
    "-DNO_AUDIO",
    "-I",
    resolve(praatRoot, "kar"),
    "-I",
    resolve(praatRoot, "melder"),
    "-I",
    resolve(praatRoot, "sys"),
    "-I",
    resolve(praatRoot, "dwsys"),
    "-I",
    resolve(praatRoot, "stat"),
    "-I",
    resolve(praatRoot, "fon"),
    "-lembind",
    ...praatLibs,
    "--no-entry",
    "-sMODULARIZE=1",
    "-sEXPORT_ES6=1",
    "-sENVIRONMENT=web,worker,node",
    "-sALLOW_MEMORY_GROWTH=1",
    "-O2",
    "-o",
    outJs,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Emscripten detected.");
console.log("Praat source detected:", praatRoot);
console.log("Built Praat-backed WASM wrapper:");
console.log(" ", outJs);
console.log(" ", resolve(outDir, "praat-voice-garden.wasm"));
console.log("");
console.log("Smoke-test it with `npm run smoke:wasm`.");
