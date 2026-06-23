// ---- reference zones for voice feminization (gentle guidance, not law) ----
//
// CRITICAL COLOR CONVENTION:
//   blue  #bcd3f0 = MASCULINE / deeper gendered end ONLY (never "needs work")
//   pink  #ffb6d5 = good / feminine end
//   butter #ffe9a8 = neutral / mid
//   GROW  #cdc6da = neutral "room to grow" for skill metrics (breathy/rough/flat)
export interface Zone {
  from: number;
  to: number;
  color: string;
  name: string;
}

export const MASC = "#bcd3f0"; // masculine-gendered end ONLY
export const FEM = "#ffb6d5"; // good / feminine end
export const BUTTER = "#ffe9a8"; // neutral / mid
// "Room to grow" tone for skill metrics — NOT blue (blue is reserved for
// masculine-gendered ends only, never for generic "needs work").
export const GROW = "#cdc6da";

export const PITCH_ZONES: Zone[] = [
  { from: 100, to: 145, color: MASC, name: "masc" },
  { from: 145, to: 165, color: BUTTER, name: "neutral" },
  { from: 165, to: 260, color: FEM, name: "fem" },
];

// Resonance (formants F2 & F3) — the brightness / vocal-tract-size cue.
//
// MEASURE: vowel-targeted **median** F2/F3 over loud, stable vowel nuclei (not
// the old all-frames mean) — see `vowel_formants()` in analyze.py.
//
// REFERENCE-GROUNDED on **VCTK American speakers** via
// `scripts/build_reference_set.py` (single consistent corpus, measured with the
// SAME method): n = 17 female, 4 male.
//   F2: FEMALE mean 1450 Hz (1280…1646) · MALE mean 1281 Hz (1234…1325)
//   F3: FEMALE mean 2742 Hz (2403…3049) · MALE mean 2523 Hz (2365…2695)
//
// F2 separates the sexes (~169 Hz, female higher); F3 less so (~219 Hz, heavy
// overlap) — real-but-imperfect cues, not hard lines. Bands are set so each
// sex's MEAN lands in its zone (female → FEM, male → MASC) with the overlap as
// the neutral band. Caveats: small male n (4); the user reads the Rainbow
// Passage while refs read other sentences, so median formants stay somewhat
// content-dependent — guidance, not law. Re-ground after adding speakers via
// `build_reference_set.py`.
//
// COLOR RULE (strict): blue MASC = deeper/masculine (LOWER) ONLY; pink FEM =
// brighter/feminine (HIGHER); butter = the overlap between.
export const F2_ZONES: Zone[] = [
  { from: 1100, to: 1340, color: MASC, name: "deeper" },
  { from: 1340, to: 1420, color: BUTTER, name: "neutral" },
  { from: 1420, to: 2200, color: FEM, name: "bright" },
];

export const F3_ZONES: Zone[] = [
  { from: 2100, to: 2560, color: MASC, name: "deeper" },
  { from: 2560, to: 2700, color: BUTTER, name: "neutral" },
  { from: 2700, to: 3400, color: FEM, name: "bright" },
];

export const LOUD_ZONES: Zone[] = [
  { from: 45, to: 55, color: "#d7d0e8", name: "soft" },
  { from: 55, to: 65, color: "#cdeadd", name: "comfy" },
  { from: 65, to: 78, color: "#ffd9ea", name: "strong" },
];

// SD of pitch — how much your melody moves. Higher = more expressive.
export const SD_ZONES: Zone[] = [
  { from: 0, to: 20, color: GROW, name: "flat" },
  { from: 20, to: 40, color: BUTTER, name: "natural" },
  { from: 40, to: 80, color: FEM, name: "expressive" },
];

// HNR — clarity vs. breathiness. (Running speech reads lower than a held vowel.)
export const HNR_ZONES: Zone[] = [
  { from: 0, to: 10, color: GROW, name: "breathy" },
  { from: 10, to: 18, color: BUTTER, name: "clear-ish" },
  { from: 18, to: 35, color: FEM, name: "clear" },
];

// Jitter — cycle-to-cycle steadiness. LOWER is better, so steady end is pink.
export const JITTER_ZONES: Zone[] = [
  { from: 0, to: 1, color: FEM, name: "steady" },
  { from: 1, to: 2, color: BUTTER, name: "okay" },
  { from: 2, to: 6, color: GROW, name: "rough" },
];

// Vocal weight via **corrected H1*–A3*** (Iseli–Alwan 2007 source spectral tilt,
// dB; voiced-gated). This is the *source* (vocal folds) measured independent of
// the vocal-tract filter — the formant-correction step removes resonance, which
// is what the old alpha ratio was accidentally re-measuring. NOTE the direction
// FLIPPED vs the old alpha ratio: a SMALLER value = steeper source roll-off =
// LIGHTER (feminine); a LARGER value = flatter source = HEAVIER (masculine). So
// the FEM band is now the LOW end, MASC the HIGH end.
//
// REFERENCE-GROUNDED on **VCTK American** via `build_reference_set.py` (n = 17
// female, 4 male): FEMALE mean ~9 dB (5…14) · MALE mean ~13 dB (7…16) — ~4 dB
// apart, female lighter. Direction: lower = lighter/feminine.
//
// ⚠️ WEIGHT DOESN'T SCALE WELL AS A GENDER CUE. The male sample is tiny (n=4)
// and the M/F ranges overlap heavily (plenty of women reach into the "heavy"
// range); a separate mixed-corpus sample showed almost NO separation at all. So
// treat the M/F bands as loose orientation only — weight is best read as **your
// OWN change over time across your samples**, not a vs-other-people verdict. The
// `note.weight` slot says this to the user. Only the direction (lower = lighter)
// is reliable.
export const WEIGHT_ZONES: Zone[] = [
  { from: 0, to: 10, color: FEM, name: "light" },
  { from: 10, to: 12.5, color: BUTTER, name: "overlap" },
  { from: 12.5, to: 20, color: MASC, name: "heavy" },
];

// In-register melody (semitones SD, register crashes removed). Expressiveness,
// NOT a gendered cue — so no blue. flat = room to grow, lively = good. Rachel's
// lovely take #1 hit ~4 st; her flat takes sit ~1.9–2 st.
export const MELODY_ZONES: Zone[] = [
  { from: 0, to: 2, color: GROW, name: "flat" },
  { from: 2, to: 3.5, color: BUTTER, name: "natural" },
  { from: 3.5, to: 7, color: FEM, name: "lively" },
];

export function zoneOf(zones: Zone[], v: number | null | undefined): Zone | null {
  if (v === null || v === undefined) return null;
  return zones.find((z) => v >= z.from && v < z.to) || zones[zones.length - 1];
}

export function fmt(v: number | null | undefined, unit = ""): string {
  return v === null || v === undefined ? "—" : v + unit;
}
