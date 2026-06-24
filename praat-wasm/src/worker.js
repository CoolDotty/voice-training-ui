import { analyzePcm } from "./jsAnalyzer.js";
import { analyzePcmWithPraat } from "./praatWasmAnalyzer.js";

self.onmessage = async (event) => {
  const { id, input } = event.data || {};
  try {
    let result;
    try {
      result = await analyzePcmWithPraat(input);
    } catch {
      result = analyzePcm(input);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
