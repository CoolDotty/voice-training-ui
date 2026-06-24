import type { Recording, RecordingDetail } from "../types";
import { createAnalysisWorkerClient as createPraatWorkerClient } from "@voice-garden/praat-wasm";

export interface AnalyzePcmInput {
  samples: Float32Array;
  sampleRate: number;
  label?: string;
  note?: string;
  registerFloor?: number;
  id?: number;
  date?: string;
  sourceFile?: string;
}

export interface AnalyzeDiagnostics {
  engine: "voice-garden-js-spike" | "praat-wasm";
  sampleRate: number;
  samples: number;
  unsupportedMetrics: string[];
  elapsedMs: number | null;
}

export interface AnalyzePcmResult {
  recording: Recording;
  detail: RecordingDetail;
  diagnostics: AnalyzeDiagnostics;
}

export interface AnalysisWorkerClient {
  analyze(input: AnalyzePcmInput): Promise<AnalyzePcmResult>;
  terminate(): void;
}

export function createAnalysisWorkerClient(): AnalysisWorkerClient {
  const client = createPraatWorkerClient() as AnalysisWorkerClient;
  return {
    analyze(input) {
      return client.analyze(input).then(validateAnalyzeResult);
    },
    terminate() {
      client.terminate();
    },
  };
}

function validateAnalyzeResult(result: unknown): AnalyzePcmResult {
  if (!isObject(result)) throw new Error("Analysis worker returned an invalid result");
  if (!isObject(result.recording)) throw new Error("Analysis result is missing recording");
  if (!isObject(result.detail)) throw new Error("Analysis result is missing detail");
  if (!isObject(result.diagnostics)) throw new Error("Analysis result is missing diagnostics");
  const detail = result.detail;
  const diagnostics = result.diagnostics;
  if (!isObject(detail.frames)) throw new Error("Analysis detail is missing frames");
  if (!Array.isArray(detail.frames.t) || !Array.isArray(detail.frames.hz)) {
    throw new Error("Analysis detail is missing frame arrays");
  }
  if (typeof diagnostics.engine !== "string") {
    throw new Error("Analysis diagnostics are missing engine");
  }
  if (!Array.isArray(diagnostics.unsupportedMetrics)) {
    throw new Error("Analysis diagnostics are missing unsupported metrics");
  }
  return result as unknown as AnalyzePcmResult;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
