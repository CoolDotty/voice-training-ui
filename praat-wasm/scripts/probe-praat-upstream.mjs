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

const emcc = spawnSync("emcc", ["--version"], { encoding: "utf8" });
if (emcc.status !== 0 && !existsSync(resolve(emsdkRoot, "emsdk_env.bat"))) {
  console.error("Missing emcc. Install and activate Emscripten first.");
  console.error("On Windows, a local SDK can live at vendor/emsdk.");
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

const makeArgs = [
  "make",
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

const runDirect = () =>
  spawnSync("emmake", makeArgs, {
    cwd: praatRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

let result = runDirect();

if (result.status !== 0 && process.platform === "win32" && existsSync(resolve(emsdkRoot, "emsdk_env.bat"))) {
  const command = `call "${resolve(emsdkRoot, "emsdk_env.bat")}" >nul && emmake ${makeArgs.join(" ")}`;
  result = spawnSync("cmd", ["/d", "/s", "/c", command], {
    cwd: praatRoot,
    env,
    stdio: "inherit",
  });
}

process.exit(result.status ?? 1);
