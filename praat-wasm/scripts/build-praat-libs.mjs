import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const praatRoot = resolve(root, "vendor", "praat");
const emsdkRoot = resolve(root, "vendor", "emsdk");

if (!existsSync(praatRoot)) {
  console.error("Missing vendor/praat. Run `npm run fetch:praat` first.");
  process.exit(1);
}

const jobsArg = process.argv.find((arg) => arg.startsWith("--jobs="));
const jobs = jobsArg?.slice("--jobs=".length) || "2";

const wingetMake = resolve(
  process.env.LOCALAPPDATA || "",
  "Microsoft",
  "WinGet",
  "Packages",
  "ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe",
  "bin",
);
const gitUsrBin = "C:\\Program Files\\Git\\usr\\bin";
const pathParts = [process.env.PATH || ""];

if (existsSync(wingetMake)) {
  pathParts.unshift(wingetMake);
}

if (existsSync(gitUsrBin)) {
  pathParts.unshift(gitUsrBin);
}

const env = {
  ...process.env,
  PATH: pathParts.join(delimiter),
  CPPFLAGS: [process.env.CPPFLAGS, "-DNO_AUDIO"].filter(Boolean).join(" "),
};

const commonMakeArgs = [
  "PRAAT_OS=linux",
  "PRAAT_GRAPHICS=barren",
  "PRAAT_AUDIO=none",
  "CC=emcc",
  "CXX=em++",
  "LINKER_COMMAND=em++",
  "AR=emar",
  "RANLIB=emranlib",
  `-j${jobs}`,
];

const targets = [
  "external/clapack",
  "external/gsl",
  "external/num",
  "kar",
  "melder",
  "sys",
  "dwsys",
  "stat",
  "fon",
];

function runWithActiveEmscripten(args) {
  return spawnSync("emmake", ["make", ...args], {
    cwd: praatRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function runWithLocalEmsdk(args) {
  const envScript = resolve(emsdkRoot, "emsdk_env.bat");
  if (process.platform !== "win32" || !existsSync(envScript)) {
    return { status: 1 };
  }

  const command = `call "${envScript}" >nul && emmake make ${args.join(" ")}`;
  return spawnSync("cmd", ["/d", "/s", "/c", command], {
    cwd: praatRoot,
    env,
    stdio: "inherit",
  });
}

for (const target of targets) {
  const args = ["-C", target, ...commonMakeArgs];
  console.log(`\n==> Building Praat ${target}`);
  let result = runWithActiveEmscripten(args);

  if (result.status !== 0) {
    result = runWithLocalEmsdk(args);
  }

  if (result.status !== 0) {
    console.error(`Failed building Praat ${target}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nBuilt Praat libraries for the Voice Garden WASM wrapper.");
