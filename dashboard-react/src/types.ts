// Typed data model matching recordings.json (source of truth).
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

// Vocal weight via corrected H1*–A3* (Iseli–Alwan source spectral tilt, the
// voice *source* spectrum measured independent of the vocal-tract filter).
export interface Weight {
  h1a3c_db: number | null; // corrected H1*–A3* (dB), voiced-gated. SMALLER = lighter/airier (fem); larger = heavier
  h1a3_db?: number | null; // uncorrected H1–A3 (dB), cheap secondary
  tilt_db_khz?: number | null; // legacy LTAS slope (dB/kHz)
}

// Headline register/phrasing numbers folded into each recording entry.
export interface Register {
  floor_hz: number;
  in_register_pct: number | null;
  semitones_sd: number | null; // raw pitch variation (inflated by crashes)
  in_register_semitones_sd: number | null; // true in-register melody
  onset_sub_pct: number | null; // % sub-register at phrase starts
  mid_sub_pct: number | null; // ...middles
  offset_sub_pct: number | null; // ...endings (usually worst)
  phrases_landed_pct: number | null; // % phrase endings that stayed in register
  n_phrases: number;
}

export interface Recording {
  id: number;
  label: string;
  note: string;
  date: string;
  source_file: string;
  audio: string | null;
  detail?: string; // path (relative to public/) to the heavy analysis JSON
  duration_s: number | null;
  pitch: Pitch;
  formants: Formants;
  voice_quality: VoiceQuality;
  intensity: Intensity;
  weight?: Weight;
  register?: Register;
}

// A web reference voice (real man's / woman's clip) measured with the SAME
// analyze() pipeline as Rachel's takes, loaded at runtime from reference.json.
export interface ReferenceVoice {
  label: string;
  gender: "f" | "m";
  source: string;
  audio?: string; // path (relative to public/) to a short playable preview clip
  pitch: { mean_hz: number | null; sd_hz: number | null };
  formants: { f2_hz: number | null; f3_hz: number | null };
  intensity: { mean_db: number | null };
  voice_quality: { hnr_db: number | null; jitter_pct: number | null };
  weight: { h1a3c_db: number | null };
}

// One phrase (a "sounding" stretch between silences) from the detail file.
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

// The heavy per-recording analysis at public/analysis/<id>.json.
export interface RecordingDetail {
  register_floor_hz: number;
  semitone_ref_hz: number;
  duration_s: number;
  time_step: number;
  frames: { t: number[]; hz: (number | null)[] };
  phrases: Phrase[];
  summary: Register;
}
