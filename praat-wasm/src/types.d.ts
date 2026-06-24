export interface AnalyzePcmInput {
  samples: Float32Array | number[];
  sampleRate: number;
  label?: string;
  note?: string;
  registerFloor?: number;
  id?: number;
  date?: string;
  sourceFile?: string;
}

export interface Pitch {
  mean_hz: number | null;
  median_hz: number | null;
  min_hz: number | null;
  max_hz: number | null;
  range_hz: number | null;
  sd_hz: number | null;
}

export interface Formants {
  f1_hz: number | null;
  f2_hz: number | null;
  f3_hz: number | null;
}

export interface VoiceQuality {
  hnr_db: number | null;
  jitter_pct: number | null;
  shimmer_pct: number | null;
}

export interface Intensity {
  mean_db: number | null;
  min_db: number | null;
  max_db: number | null;
}

export interface Register {
  floor_hz: number;
  in_register_pct: number | null;
  semitones_sd: number | null;
  in_register_semitones_sd: number | null;
  onset_sub_pct: number | null;
  mid_sub_pct: number | null;
  offset_sub_pct: number | null;
  phrases_landed_pct: number | null;
  n_phrases: number;
}

export interface Phrase {
  start: number;
  end: number;
  onset_hz: number;
  offset_hz: number;
  min_hz: number;
  started_in_register: boolean;
  ended_in_register: boolean;
  sub_register_pct: number;
}

export interface RecordingDetail {
  register_floor_hz: number;
  semitone_ref_hz: number;
  duration_s: number;
  time_step: number;
  frames: { t: number[]; hz: Array<number | null> };
  phrases: Phrase[];
  summary: Register;
}

export interface Recording {
  id: number;
  label: string;
  note: string;
  date: string;
  source_file: string;
  audio: string | null;
  audioBlobId?: string;
  detail?: string;
  detailId?: string;
  duration_s: number | null;
  pitch: Pitch;
  formants: Formants;
  voice_quality: VoiceQuality;
  intensity: Intensity;
  register: Register;
}

export interface AnalyzeDiagnostics {
  engine: "voice-garden-js-spike" | "praat-wasm";
  sampleRate: number;
  samples: number;
  unsupportedMetrics: string[];
  elapsedMs: number;
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

export function analyzePcm(input: AnalyzePcmInput): AnalyzePcmResult;
export function analyzePcmWithPraat(input: AnalyzePcmInput): Promise<AnalyzePcmResult>;
export function createAnalysisWorkerClient(worker?: Worker): AnalysisWorkerClient;
