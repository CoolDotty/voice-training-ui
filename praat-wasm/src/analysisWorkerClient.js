export function createAnalysisWorkerClient(worker = defaultWorker()) {
  let nextId = 1;
  const pending = new Map();
  let closed = false;

  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data || {};
    const slot = pending.get(id);
    if (!slot) return;
    pending.delete(id);
    if (ok) slot.resolve(result);
    else slot.reject(new Error(error || "Analysis worker failed"));
  };

  worker.onerror = (event) => {
    rejectPending(new Error(event.message || "Analysis worker failed"));
  };

  return {
    analyze(input) {
      if (closed) {
        return Promise.reject(new Error("Analysis worker has been terminated"));
      }
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const transfer = input.samples instanceof Float32Array ? [input.samples.buffer] : [];
        worker.postMessage({ id, input }, transfer);
      });
    },
    terminate() {
      if (closed) return;
      closed = true;
      rejectPending(new Error("Analysis cancelled"));
      worker.terminate();
    },
  };

  function rejectPending(error) {
    for (const slot of pending.values()) {
      slot.reject(error);
    }
    pending.clear();
  }
}

function defaultWorker() {
  return new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
}
