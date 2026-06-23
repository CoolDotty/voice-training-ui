"""Voice training analyzer 🌸

Analyzes a recording with Praat (via parselmouth) and adds it to the dashboard.

Two layers of analysis run on every recording:
  1. Standard summary metrics (pitch, formants, voice quality, intensity) →
     appended to recordings.json for the permanent dashboard cards.
  2. Detailed register & phrasing analysis (frame-level F0 contour, register
     stability, silence-based phrase segmentation, per-phrase boundary
     behavior) → written to dashboard-react/public/analysis/<id>.json for the
     permanent "Register & phrasing" visualizer, plus a few headline numbers
     folded into the recording entry.

Usage:
    uv run analyze.py "/path/to/recording.mp3" --label "trying to be louder"
    uv run analyze.py "clip.wav" --label "pitch + bright resonance" --note "felt strained"
    uv run analyze.py "clip.wav" --label "..." --register-floor 130

recordings.json (repo root) is the source of truth. The React app in
dashboard-react/ reads everything from its public/ dir at runtime.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import statistics
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import numpy as np
import parselmouth
from parselmouth.praat import call

ROOT = Path(__file__).resolve().parent
RECORDINGS_JSON = ROOT / "recordings.json"  # source of truth

# The React dashboard (dashboard-react) reads these at runtime from public/.
APP_PUBLIC = ROOT / "dashboard-react" / "public"
PUBLIC_RECORDINGS_JSON = APP_PUBLIC / "recordings.json"
AUDIO_DIR = APP_PUBLIC / "audio"
ANALYSIS_DIR = APP_PUBLIC / "analysis"

# Pitch search range (Hz). Wide enough for a feminizing voice without octave errors.
PITCH_FLOOR = 75.0
PITCH_CEILING = 500.0
# Formant ceiling: 5500 Hz is the standard reference for a feminine vocal tract.
FORMANT_CEILING = 5500.0
# Default register floor (Hz): below this, the voice has "crashed" out of the
# trained register back toward chest/male pitch. Adjustable via --register-floor.
DEFAULT_REGISTER_FLOOR = 130.0
# Semitone reference (Hz). Only matters for absolute st values; variation (SD)
# is reference-independent. 100 Hz matches Praat's "semitones re 100 Hz".
SEMITONE_REF = 100.0


def clean(value: float | None) -> float | None:
    """Round and convert NaN/inf to None so it serializes cleanly to JSON."""
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return round(float(value), 2)


def hz_to_st(hz: float, ref: float = SEMITONE_REF) -> float:
    """Convert a frequency to semitones — the perceptual scale for pitch."""
    return 12.0 * math.log2(hz / ref)


def sd(values: list[float]) -> float | None:
    """Sample standard deviation, or None if too few values."""
    return statistics.stdev(values) if len(values) >= 2 else None


def to_wav_mono(src: Path) -> Path:
    """Convert any audio file to a temp mono WAV for analysis via ffmpeg."""
    tmp = Path(tempfile.mkdtemp()) / "analysis.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "44100", str(tmp)],
        check=True,
        capture_output=True,
    )
    return tmp


def _iseli_correction(f_harmonic: float, f_formant: float, bw_formant: float,
                      fs: float) -> float:
    """Iseli–Alwan (2007) vocal-tract correction for one formant, in dB.

    Models a formant as a single pole pair at frequency `f_formant` with
    bandwidth `bw_formant`. Returns the dB boost that pole adds to the spectrum
    at frequency `f_harmonic` (sampling rate `fs`). Subtracting this from a
    measured harmonic amplitude recovers the *source* amplitude — removing the
    resonance (filter) contribution. Eq. (5)–(6) of Iseli, Shue & Alwan,
    "Age, sex, and vowel dependencies of the relationship between source and
    vocal-tract characteristics" (JASA 2007), as implemented in VoiceSauce.
    """
    # Pole location on the unit circle (z = r·e^{jθ}).
    r = math.exp(-math.pi * bw_formant / fs)
    omega = 2 * math.pi * f_formant / fs
    omega_h = 2 * math.pi * f_harmonic / fs
    # |H(e^{jw})|^2 contribution of this conjugate pole pair, normalised at DC.
    # Correction = 10·log10( numerator / denominator ).
    num = (r**2 - 2 * r * math.cos(omega) + 1) ** 2
    den = (
        (r**2 - 2 * r * math.cos(omega + omega_h) + 1)
        * (r**2 - 2 * r * math.cos(omega - omega_h) + 1)
    )
    if den <= 0 or num <= 0:
        return 0.0
    return 10.0 * math.log10(num / den)


def _harmonic_db(spec_freqs: np.ndarray, spec_db: np.ndarray, target_hz: float,
                 f0: float) -> float | None:
    """Peak-pick the harmonic amplitude (dB) nearest `target_hz` by searching a
    ±F0/2 window of a narrowband magnitude spectrum and taking the local max."""
    if target_hz <= 0 or f0 <= 0:
        return None
    half = max(f0 * 0.5, 20.0)
    mask = (spec_freqs >= target_hz - half) & (spec_freqs <= target_hz + half)
    if not mask.any():
        return None
    vals = spec_db[mask]
    peak = float(np.max(vals))
    if math.isnan(peak) or math.isinf(peak):
        return None
    return peak


def spectral_weight(sound: parselmouth.Sound) -> dict:
    """Vocal *weight* via **corrected H1*–A3*** — the Iseli–Alwan (2007) source
    spectral-tilt measure (as used in VoiceSauce).

    Operates ONLY on voiced frames (gated by the pitch track — no consonants or
    silence). Per voiced frame we measure, from a windowed narrowband FFT:
      - H1 = amplitude (dB) of the harmonic nearest F0,
      - A3 = amplitude (dB) of the harmonic nearest F3,
    then **formant-correct** both with the Iseli–Alwan vocal-tract model (each of
    F1–F3 treated as a pole with its bandwidth; we subtract the formant boost so
    we recover the *source* amplitude). This is the crucial difference from a raw
    alpha ratio, which just re-measures resonance (the filter). Praat's
    `To Formant (burg)` supplies F1–F3 + bandwidths per frame.

    The headline value is mean **corrected H1*–A3*** over voiced frames (dB).
    Larger H1*–A3* = steeper source roll-off = LIGHTER (more feminine); smaller
    (flatter) = HEAVIER. (Opposite direction from the old alpha ratio.)

    Returns:
      - h1a3c_db: mean corrected H1*–A3* over voiced frames (the headline).
      - h1a3_db:  mean UNcorrected H1–A3 over voiced frames (cheap secondary).
      - tilt_db_khz: LTAS regression slope (dB/kHz), kept as a legacy secondary.
    """
    fs = sound.sampling_frequency
    dur = sound.get_total_duration()
    pitch = call(sound, "To Pitch", 0.0, PITCH_FLOOR, PITCH_CEILING)
    formant = call(sound, "To Formant (burg)", 0.0, 5, FORMANT_CEILING, 0.025, 50)

    # Voiced frames: pull the whole F0 track in one numpy shot (no per-frame
    # Praat round-trips), then subsample so cost is bounded on long recordings —
    # an averaged source-tilt measure is stable over a few hundred frames.
    f0s = pitch.selected_array["frequency"]
    ts = pitch.xs()
    voiced = [(float(t), float(f)) for t, f in zip(ts, f0s) if f > 0]
    max_frames = 250
    if len(voiced) > max_frames:
        step = len(voiced) / max_frames
        voiced = [voiced[int(i * step)] for i in range(max_frames)]

    h1a3c_vals: list[float] = []
    h1a3_vals: list[float] = []

    for t, f0 in voiced:
        # Narrowband windowed spectrum around this frame (>=3 pitch periods for
        # frequency resolution to separate harmonics).
        win = max(0.025, 3.0 / f0)
        t0 = t - win / 2
        t1 = t + win / 2
        if t0 < 0 or t1 > dur:
            continue
        try:
            seg = sound.extract_part(t0, t1, parselmouth.WindowShape.HAMMING, 1.0, False)
            spec = seg.to_spectrum()  # parselmouth obj; read bins as numpy below
        except Exception:
            continue
        vals = spec.values  # shape (2, n_bins): row 0 real, row 1 imag — one shot
        power = vals[0] ** 2 + vals[1] ** 2
        freqs = np.asarray(spec.xs())
        with np.errstate(divide="ignore"):
            spec_db = 10.0 * np.log10(np.where(power > 0, power, np.nan))

        # Formants + bandwidths at this frame.
        fb: dict[int, tuple[float, float]] = {}
        ok = True
        for n in (1, 2, 3):
            fn = call(formant, "Get value at time", n, t, "Hertz", "Linear")
            bn = call(formant, "Get bandwidth at time", n, t, "Hertz", "Linear")
            if math.isnan(fn) or math.isnan(bn) or fn <= 0 or bn <= 0:
                ok = False
                break
            fb[n] = (fn, bn)
        if not ok:
            continue

        h1 = _harmonic_db(freqs, spec_db, f0, f0)
        # A3 = harmonic nearest F3.
        f3 = fb[3][0]
        k3 = max(1, round(f3 / f0))
        a3 = _harmonic_db(freqs, spec_db, k3 * f0, f0)
        if h1 is None or a3 is None:
            continue

        # Iseli–Alwan correction: subtract each formant's boost at the harmonic
        # frequency to recover the source amplitude. H1 is near F0 → correct it
        # against all three poles; A3 sits at F3 → correct against all three too.
        h1_corr = h1
        a3_corr = a3
        for n in (1, 2, 3):
            fn, bn = fb[n]
            h1_corr -= _iseli_correction(f0, fn, bn, fs)
            a3_corr -= _iseli_correction(k3 * f0, fn, bn, fs)

        h1a3c = h1_corr - a3_corr
        h1a3 = h1 - a3
        if not (math.isnan(h1a3c) or math.isinf(h1a3c)):
            h1a3c_vals.append(h1a3c)
        if not (math.isnan(h1a3) or math.isinf(h1a3)):
            h1a3_vals.append(h1a3)

    h1a3c = float(np.mean(h1a3c_vals)) if h1a3c_vals else None
    h1a3 = float(np.mean(h1a3_vals)) if h1a3_vals else None

    # Legacy LTAS tilt, kept as a cheap secondary.
    tilt = None
    try:
        ltas = call(sound, "To Ltas", 100.0)
        freqs_l: list[float] = []
        vals_l: list[float] = []
        for f in range(100, 5001, 100):
            v = call(ltas, "Get value at frequency", float(f), "Linear")
            if not (math.isnan(v) or math.isinf(v)):
                freqs_l.append(float(f))
                vals_l.append(v)
        if len(freqs_l) >= 4:
            tilt = float(np.polyfit(np.array(freqs_l), np.array(vals_l), 1)[0] * 1000.0)
    except Exception:
        tilt = None

    return {
        "h1a3c_db": clean(h1a3c),
        "h1a3_db": clean(h1a3),
        "tilt_db_khz": clean(tilt),
    }


def vowel_formants(sound: parselmouth.Sound, pitch: parselmouth.Pitch) -> dict:
    """Vowel-nucleus-targeted F1/F2/F3 (median over vowel cores), in Hz.

    The old method averaged each formant over EVERY voiced frame, which folds in
    consonant transitions, glides, schwas and tracker mistracks — that compresses
    the signal so it barely separates the sexes (on VCTK: women's F2 mean 1639 vs
    men's 1566, only ~73 Hz apart). Resonance should separate them much better.

    Instead we gate to frames that are voiced AND vowel-like, then take the
    MEDIAN (robust to the outliers a mean drags in):
      1. **Voiced** — F0 present at the frame (pulled from the pitch track in one
         numpy shot, then subsampled to <=300 frames so cost is bounded on long
         clips; no per-bin Praat round-trips).
      2. **Loud** — within 10 dB of the clip's peak intensity. Vowel nuclei are
         the loud cores of syllables; consonants and glides are quieter.
      3. **Plausible vowel F1** — F1 in ~250–1000 Hz (real vowel-space range);
         rejects nasals/approximants and obvious mistracks.
      4. **Stable** — small frame-to-frame change in F2 (<= ~150 Hz vs its
         neighbour), so we keep the steady vowel core and drop transitions/glides
         where the tracker is sliding.

    From the surviving vowel frames we take the median F1, F2, F3. F1 uses the
    same gated set for consistency; F2/F3 are the focus (the real brightness cue).

    Ceiling note: `To Formant (burg)` uses a single max-formant ceiling
    (FORMANT_CEILING = 5500 Hz), tuned for a feminine/shorter vocal tract. On the
    reference MEN this can mistrack (their formants are lower; a 5500 ceiling can
    pack an extra spurious formant in). We measure twice — once at 5500 and once
    at a lower 5000 ceiling typical for longer (masculine) tracts — and pick the
    ceiling whose vowel-gated frames give the **tighter** (lower-spread) F2
    distribution, i.e. the cleaner track. This is applied uniformly to takes AND
    refs, so M/F stay comparable; it costs one extra Formant pass and no per-bin
    loops, so runtime stays bounded.
    """
    f0s = pitch.selected_array["frequency"]
    ts = pitch.xs()
    voiced_idx = [i for i, f in enumerate(f0s) if f > 0]
    if not voiced_idx:
        return {1: None, 2: None, 3: None}

    # Loud gate: intensity track in one shot; threshold = peak - 10 dB.
    intensity = call(sound, "To Intensity", PITCH_FLOOR, 0, "yes")
    int_vals = intensity.values[0]
    int_ts = intensity.xs()
    int_max = float(np.nanmax(int_vals))
    loud_floor = int_max - 10.0

    def int_at(t: float) -> float:
        j = int(np.searchsorted(int_ts, t))
        j = min(max(j, 0), len(int_vals) - 1)
        return float(int_vals[j])

    # Candidate vowel-core times: voiced + loud. Subsample to bound cost.
    cand_ts = [float(ts[i]) for i in voiced_idx if int_at(float(ts[i])) >= loud_floor]
    max_frames = 300
    if len(cand_ts) > max_frames:
        step = len(cand_ts) / max_frames
        cand_ts = [cand_ts[int(k * step)] for k in range(max_frames)]

    def measure(ceiling: float) -> dict[int, list[float]]:
        formant = call(sound, "To Formant (burg)", 0.0, 5, ceiling, 0.025, 50)
        rows: list[tuple[float, float, float, float]] = []  # (t, f1, f2, f3)
        for t in cand_ts:
            vals = []
            ok = True
            for n in (1, 2, 3):
                v = formant.get_value_at_time(n, t)
                if math.isnan(v) or v <= 0:
                    ok = False
                    break
                vals.append(v)
            if not ok:
                continue
            f1, f2, f3 = vals
            if not (250.0 <= f1 <= 1000.0):  # plausible vowel F1
                continue
            rows.append((t, f1, f2, f3))
        # Stability gate: drop frames where F2 jumps vs the previous kept frame
        # (transitions/glides). Keep the steady vowel cores.
        out: dict[int, list[float]] = {1: [], 2: [], 3: []}
        prev_f2 = None
        for _t, f1, f2, f3 in rows:
            if prev_f2 is not None and abs(f2 - prev_f2) > 150.0:
                prev_f2 = f2
                continue
            out[1].append(f1)
            out[2].append(f2)
            out[3].append(f3)
            prev_f2 = f2
        return out

    # Measure at both ceilings; pick the one with the tighter F2 spread (cleaner
    # track), as long as it yields enough vowel frames.
    best = None
    best_spread = float("inf")
    for ceiling in (FORMANT_CEILING, 5000.0):
        fv = measure(ceiling)
        if len(fv[2]) < 5:
            continue
        spread = statistics.pstdev(fv[2])
        if spread < best_spread:
            best_spread = spread
            best = fv
    if best is None:
        best = measure(FORMANT_CEILING)

    return {n: (statistics.median(best[n]) if best[n] else None) for n in (1, 2, 3)}


def analyze(sound: parselmouth.Sound) -> dict:
    """Standard summary metrics for the permanent dashboard cards."""
    duration = sound.get_total_duration()

    # ---- Pitch (F0) -------------------------------------------------------
    pitch = call(sound, "To Pitch", 0.0, PITCH_FLOOR, PITCH_CEILING)
    mean_f0 = call(pitch, "Get mean", 0, 0, "Hertz")
    min_f0 = call(pitch, "Get minimum", 0, 0, "Hertz", "Parabolic")
    max_f0 = call(pitch, "Get maximum", 0, 0, "Hertz", "Parabolic")
    sd_f0 = call(pitch, "Get standard deviation", 0, 0, "Hertz")
    median_f0 = call(pitch, "Get quantile", 0, 0, 0.5, "Hertz")

    # ---- Formants (resonance): vowel-nucleus-targeted median (F2/F3 focus) -
    mean_formant = vowel_formants(sound, pitch)

    # ---- Voice quality: HNR, jitter, shimmer -----------------------------
    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, PITCH_FLOOR, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0, 0)

    point_process = call(sound, "To PointProcess (periodic, cc)", PITCH_FLOOR, PITCH_CEILING)
    jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
    shimmer = call(
        [sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
    )

    # ---- Intensity (loudness) — directly relevant to "be louder" ---------
    intensity = call(sound, "To Intensity", PITCH_FLOOR, 0, "yes")
    mean_int = call(intensity, "Get mean", 0, 0, "energy")
    min_int = call(intensity, "Get minimum", 0, 0, "Parabolic")
    max_int = call(intensity, "Get maximum", 0, 0, "Parabolic")

    return {
        "duration_s": clean(duration),
        "pitch": {
            "mean_hz": clean(mean_f0),
            "median_hz": clean(median_f0),
            "min_hz": clean(min_f0),
            "max_hz": clean(max_f0),
            "range_hz": clean(max_f0 - min_f0) if not (math.isnan(min_f0) or math.isnan(max_f0)) else None,
            "sd_hz": clean(sd_f0),
        },
        "formants": {
            "f1_hz": clean(mean_formant[1]),
            "f2_hz": clean(mean_formant[2]),
            "f3_hz": clean(mean_formant[3]),
        },
        "voice_quality": {
            "hnr_db": clean(hnr),
            "jitter_pct": clean(jitter * 100 if not math.isnan(jitter) else None),
            "shimmer_pct": clean(shimmer * 100 if not math.isnan(shimmer) else None),
        },
        "intensity": {
            "mean_db": clean(mean_int),
            "min_db": clean(min_int),
            "max_db": clean(max_int),
        },
        "weight": spectral_weight(sound),
    }


def segment_phrases(sound: parselmouth.Sound) -> list[tuple[float, float]]:
    """Split the recording into phrases using silence detection.

    Returns a list of (start, end) times for the "sounding" stretches.
    """
    intensity = sound.to_intensity(minimum_pitch=PITCH_FLOOR)
    grid = call(
        intensity, "To TextGrid (silences)", -25.0, 0.1, 0.05, "silent", "sounding"
    )
    spans: list[tuple[float, float]] = []
    n_int = int(call(grid, "Get number of intervals", 1))
    for i in range(1, n_int + 1):
        if call(grid, "Get label of interval", 1, i) == "sounding":
            t0 = call(grid, "Get start time of interval", 1, i)
            t1 = call(grid, "Get end time of interval", 1, i)
            spans.append((t0, t1))
    return spans


def analyze_register(sound: parselmouth.Sound, floor: float) -> tuple[dict, dict]:
    """Detailed register & phrasing analysis.

    Returns (detail, headline) where `detail` is the heavy per-frame/per-phrase
    payload written to public/analysis/<id>.json and `headline` is the compact
    summary folded into the recording entry for the dashboard cards.
    """
    pitch = sound.to_pitch(0.01, PITCH_FLOOR, PITCH_CEILING)
    f0 = pitch.selected_array["frequency"]
    times = pitch.xs()
    duration = sound.get_total_duration()

    # Full timeline for the contour chart (null where unvoiced).
    frames_t = [round(float(t), 3) for t in times]
    frames_hz = [round(float(h), 1) if h > 0 else None for h in f0]
    voiced = [(float(t), float(h)) for t, h in zip(times, f0) if h > 0]

    # ---- per-phrase boundary behavior + positional sub-register counts ----
    spans = segment_phrases(sound)
    phrases: list[dict] = []
    # [sub_count, total] per third of a phrase
    bins = {"onset": [0, 0], "mid": [0, 0], "offset": [0, 0]}
    for t0, t1 in spans:
        pv = [(t, h) for (t, h) in voiced if t0 <= t <= t1]
        if not pv:
            continue
        dur = (t1 - t0) or 1e-9
        onset_win = [h for (t, h) in pv if t - t0 <= 0.08] or [pv[0][1]]
        offset_win = [h for (t, h) in pv if t1 - t <= 0.12] or [pv[-1][1]]
        onset_hz = statistics.fmean(onset_win)
        offset_hz = statistics.fmean(offset_win)
        hzs = [h for (_, h) in pv]
        phrases.append({
            "start": round(t0, 3),
            "end": round(t1, 3),
            "onset_hz": round(onset_hz, 1),
            "offset_hz": round(offset_hz, 1),
            "min_hz": round(min(hzs), 1),
            "started_in_register": onset_hz >= floor,
            "ended_in_register": offset_hz >= floor,
            "sub_register_pct": round(100 * sum(h < floor for h in hzs) / len(hzs), 1),
        })
        for t, h in pv:
            rel = (t - t0) / dur
            b = "onset" if rel < 1 / 3 else "mid" if rel < 2 / 3 else "offset"
            bins[b][1] += 1
            if h < floor:
                bins[b][0] += 1

    def pct(b: list[int]) -> float | None:
        return round(100 * b[0] / b[1], 1) if b[1] else None

    # ---- overall register stability ---------------------------------------
    all_hz = [h for (_, h) in voiced]
    in_reg = [h for h in all_hz if h >= floor]
    in_register_pct = round(100 * len(in_reg) / len(all_hz), 1) if all_hz else None
    semitones_sd = clean(sd([hz_to_st(h) for h in all_hz]))
    in_register_semitones_sd = clean(sd([hz_to_st(h) for h in in_reg]))
    landed = sum(p["ended_in_register"] for p in phrases)
    landed_pct = round(100 * landed / len(phrases)) if phrases else None

    headline = {
        "floor_hz": floor,
        "in_register_pct": in_register_pct,
        "semitones_sd": semitones_sd,
        "in_register_semitones_sd": in_register_semitones_sd,
        "onset_sub_pct": pct(bins["onset"]),
        "mid_sub_pct": pct(bins["mid"]),
        "offset_sub_pct": pct(bins["offset"]),
        "phrases_landed_pct": landed_pct,
        "n_phrases": len(phrases),
    }
    detail = {
        "register_floor_hz": floor,
        "semitone_ref_hz": SEMITONE_REF,
        "duration_s": round(duration, 2),
        "time_step": 0.01,
        "frames": {"t": frames_t, "hz": frames_hz},
        "phrases": phrases,
        "summary": headline,
    }
    return detail, headline


def load_recordings() -> list[dict]:
    if RECORDINGS_JSON.exists():
        return json.loads(RECORDINGS_JSON.read_text())
    return []


def save_recordings(recordings: list[dict]) -> None:
    payload = json.dumps(recordings, indent=2)
    RECORDINGS_JSON.write_text(payload)
    APP_PUBLIC.mkdir(parents=True, exist_ok=True)
    PUBLIC_RECORDINGS_JSON.write_text(payload)


def backfill() -> None:
    """Recompute metrics for every existing recording from its stored audio,
    preserving id/label/note/date. Use after adding a new metric (e.g. weight)."""
    recordings = load_recordings()
    if not recordings:
        raise SystemExit("No recordings to backfill.")
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    for entry in recordings:
        src = AUDIO_DIR / Path(entry["audio"]).name
        if not src.exists():
            print(f"⚠️  #{entry['id']}: audio not found ({src}) — skipped")
            continue
        wav = to_wav_mono(src) if src.suffix.lower() != ".wav" else src
        sound = parselmouth.Sound(str(wav))
        floor = entry.get("register", {}).get("floor_hz", DEFAULT_REGISTER_FLOOR)
        entry.update(analyze(sound))
        detail, register = analyze_register(sound, floor)
        entry["register"] = register
        (ANALYSIS_DIR / f"{entry['id']}.json").write_text(json.dumps(detail))
        print(f"✅ #{entry['id']} backfilled — weight {entry['weight']}")
    recordings.sort(key=lambda r: r["id"])
    save_recordings(recordings)
    print("🌸 Backfill complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze a voice training recording 🌸")
    parser.add_argument("audio", nargs="?", help="Path to the audio file (mp3/m4a/wav/...)")
    parser.add_argument("--label", help="What you were trying this take")
    parser.add_argument("--note", default="", help="Optional extra note")
    parser.add_argument("--date", default="", help="Override date (YYYY-MM-DD); defaults to today")
    parser.add_argument(
        "--register-floor", type=float, default=DEFAULT_REGISTER_FLOOR,
        help=f"Hz below which the voice has crashed out of register (default {DEFAULT_REGISTER_FLOOR:g})",
    )
    parser.add_argument(
        "--id", type=int, default=None,
        help="Force this recording id (e.g. insert an older take as #1). Default: next available.",
    )
    parser.add_argument(
        "--backfill", action="store_true",
        help="Recompute metrics for ALL existing recordings from their stored audio "
             "(preserves id/label/note/date). Use after adding a new metric.",
    )
    args = parser.parse_args()

    if args.backfill:
        backfill()
        return

    if not args.audio:
        raise SystemExit("❌ Provide an audio file, or use --backfill.")
    if not args.label:
        raise SystemExit("❌ --label is required when analyzing a new recording.")

    src = Path(args.audio).expanduser()
    if not src.exists():
        raise SystemExit(f"❌ File not found: {src}")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    recordings = load_recordings()
    if args.id is not None:
        if any(r["id"] == args.id for r in recordings):
            raise SystemExit(f"❌ id {args.id} already exists — pick another or renumber first.")
        rec_id = args.id
    else:
        rec_id = (max((r["id"] for r in recordings), default=0)) + 1

    needs_convert = src.suffix.lower() != ".wav"
    wav_path = to_wav_mono(src) if needs_convert else src
    print(f"🎧 Analyzing entry #{rec_id}: {src.name} ...")
    sound = parselmouth.Sound(str(wav_path))
    metrics = analyze(sound)
    detail, register = analyze_register(sound, args.register_floor)

    playback_name = f"{rec_id:03d}{src.suffix.lower()}"
    shutil.copy2(src, AUDIO_DIR / playback_name)
    (ANALYSIS_DIR / f"{rec_id}.json").write_text(json.dumps(detail))

    entry = {
        "id": rec_id,
        "label": args.label,
        "note": args.note,
        "date": args.date or datetime.now().strftime("%Y-%m-%d"),
        "source_file": src.name,
        "audio": f"audio/{playback_name}",
        "detail": f"analysis/{rec_id}.json",
        **metrics,
        "register": register,
    }
    recordings.append(entry)
    recordings.sort(key=lambda r: r["id"])
    save_recordings(recordings)

    p, f = metrics["pitch"], metrics["formants"]
    print(
        f"✅ Done!  pitch ~{p['mean_hz']} Hz, F1/F2/F3 = "
        f"{f['f1_hz']}/{f['f2_hz']}/{f['f3_hz']} Hz, loudness "
        f"{metrics['intensity']['mean_db']} dB"
    )
    print(
        f"🎚️  Register: {register['in_register_pct']}% in-register · "
        f"phrase endings landed {register['phrases_landed_pct']}% · "
        f"sub-register by position {register['onset_sub_pct']}/"
        f"{register['mid_sub_pct']}/{register['offset_sub_pct']}% "
        f"(onset/mid/offset)"
    )
    print("🌸 Saved. Run the React dashboard (npm run dev) and refresh.")


if __name__ == "__main__":
    main()
