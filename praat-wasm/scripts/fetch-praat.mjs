import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const vendor = resolve(root, "vendor");
const target = resolve(vendor, "praat");
const repo = "https://github.com/praat/praat.git";

await mkdir(vendor, { recursive: true });

if (existsSync(target)) {
  console.log(`Praat checkout already exists: ${target}`);
  process.exit(0);
}

const result = spawnSync("git", ["clone", "--depth", "1", repo, target], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Fetched Praat source into ${target}`);

