import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";

const repoRoot = resolve("..");
const port = Number(process.env.PRAAT_WASM_SMOKE_PORT || 4178);
const sampleRate = 16_000;
const frequency = 180;

const mimeTypes = new Map([
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".wasm", "application/wasm"],
]);

const html = `<!doctype html>
<meta charset="utf-8">
<script type="module">
const worker = new Worker("/praat-wasm/src/worker.js", { type: "module" });
const sampleRate = ${sampleRate};
const frequency = ${frequency};
const samples = new Float32Array(sampleRate);

for (let i = 0; i < samples.length; i += 1) {
  samples[i] = 0.2 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
}

worker.onmessage = (event) => {
  const message = event.data;
  if (!message.ok) {
    window.__result = { ok: false, error: message.error };
    return;
  }

  window.__result = {
    ok: true,
    engine: message.result.diagnostics.engine,
    mean: message.result.recording.pitch.mean_hz,
    frames: message.result.detail.frames.t.length,
    inRegister: message.result.recording.register.in_register_pct,
  };
};

worker.onerror = (event) => {
  window.__result = { ok: false, error: event.message };
};

worker.postMessage({ id: 1, input: { samples, sampleRate, registerFloor: 130 } }, [samples.buffer]);
</script>`;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
      return;
    }

    const file = normalize(resolve(repoRoot, `.${url.pathname}`));
    if (!file.startsWith(repoRoot)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }

    const bytes = await readFile(file);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(file)) || "application/octet-stream",
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(404);
    response.end(String(error));
  }
});

await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  const result = await page
    .waitForFunction(() => window.__result, null, { timeout: 15_000 })
    .then((handle) => handle.jsonValue());

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error(result.error);
  }
  if (result.engine !== "praat-wasm") {
    throw new Error(`Expected praat-wasm engine, got ${result.engine}`);
  }
  if (Math.abs(result.mean - frequency) > 2) {
    throw new Error(`Mean pitch ${result.mean} is not close to expected ${frequency}`);
  }
  if (result.frames <= 0) {
    throw new Error("Expected voiced pitch frames");
  }
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import("../../dashboard-react/node_modules/playwright/index.mjs");
  }
}

async function launchBrowser() {
  const { chromium } = await importPlaywright();
  try {
    return await chromium.launch({ headless: true });
  } catch (managedError) {
    try {
      return await chromium.launch({ channel: "msedge", headless: true });
    } catch {
      throw managedError;
    }
  }
}
