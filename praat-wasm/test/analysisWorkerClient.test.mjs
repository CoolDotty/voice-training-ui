import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisWorkerClient } from "../src/analysisWorkerClient.js";

test("analysis worker client rejects pending work on terminate", async () => {
  const worker = new FakeWorker();
  const client = createAnalysisWorkerClient(worker);
  const pending = client.analyze({ samples: new Float32Array([0]), sampleRate: 16000 });

  client.terminate();

  await assert.rejects(pending, /Analysis cancelled/);
  assert.equal(worker.terminated, true);
});

test("analysis worker client resolves matching worker responses", async () => {
  const worker = new FakeWorker();
  const client = createAnalysisWorkerClient(worker);
  const pending = client.analyze({ samples: new Float32Array([0]), sampleRate: 16000 });

  worker.onmessage({
    data: {
      id: worker.lastMessage.id,
      ok: true,
      result: { ok: true },
    },
  });

  assert.deepEqual(await pending, { ok: true });
  client.terminate();
});

class FakeWorker {
  onmessage = null;
  onerror = null;
  lastMessage = null;
  terminated = false;

  postMessage(message) {
    this.lastMessage = message;
  }

  terminate() {
    this.terminated = true;
  }
}
