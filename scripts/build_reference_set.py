# /// script
# requires-python = ">=3.11"
# dependencies = ["praat-parselmouth", "numpy", "huggingface_hub", "pyarrow"]
# ///
"""Build / refresh the reference-voice set for Voice Garden 🌸

Downloads a set of real male & female reference speakers (VCTK American accent +
CMU ARCTIC US), measures each with the project's OWN `analyze()` (so the numbers
are directly comparable to the user's takes), and writes:
  - dashboard-react/public/reference.json   (one averaged entry per speaker)
  - dashboard-react/public/reference-audio/<key>.mp3  (that speaker's clips,
    concatenated with short gaps, for the in-modal "click to hear" previews)
It then prints per-gender means + SUGGESTED zone thresholds for zones.ts.

Re-runnable + idempotent: audio is cached in <repo>/.refcache/ (gitignored) and
reused; only missing clips are (re)downloaded. Run from anywhere:

    uv run scripts/build_reference_set.py

This is the one place the reference pipeline lives — edit it here, not ad-hoc.
"""

from __future__ import annotations

import collections
import re
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import parselmouth  # noqa: E402
from analyze import analyze, to_wav_mono  # noqa: E402

CACHE = ROOT / ".refcache"
CLIPS = CACHE / "clips"
PUBLIC = ROOT / "dashboard-react" / "public"
REF_JSON = PUBLIC / "reference.json"
REF_AUDIO = PUBLIC / "reference-audio"
N_CLIPS = 3  # clips averaged per speaker

# ---- speaker registry -----------------------------------------------------
# VCTK 0.92 American-accent speakers (from speaker-info.txt ACCENTS == American).
VCTK_FEMALE = [294, 297, 299, 300, 301, 305, 306, 308, 310, 318,
               329, 330, 333, 339, 341, 361, 362]
VCTK_MALE = [311, 315, 334, 345, 360]
# CMU ARCTIC US studio speakers — available to thicken the thin male side, but
# DISABLED: Rachel wants a single consistent corpus (VCTK only). Mixing ARCTIC
# muddied the refs (its heavy-voiced women + light man collapsed the weight
# separation and widened F2 overlap). Re-enable by listing speakers here.
ARCTIC: list[tuple[str, str]] = []


def registry() -> list[dict]:
    sp: list[dict] = []
    for i in VCTK_FEMALE + VCTK_MALE:
        g = "f" if i in VCTK_FEMALE else "m"
        sp.append({
            "key": f"vctk_{g}{i}", "corpus": "vctk", "gender": g, "vid": str(i),
            "label": f"VCTK p{i} (American)",
            "source": f"VCTK 0.92 speaker p{i} (American accent) — "
                      "https://datashare.ed.ac.uk/handle/10283/3443",
        })
    for spk, g in ARCTIC:
        sp.append({
            "key": f"arctic_{spk}", "corpus": "arctic", "gender": g, "spk": spk,
            "label": f"CMU ARCTIC {spk} (US)",
            "source": f"CMU ARCTIC {spk} (US English) — http://festvox.org/cmu_arctic/",
        })
    return sp


def clips_for(key: str) -> list[Path]:
    return sorted(CLIPS.glob(f"{key}_*"))


# ---- downloads (only what's missing) --------------------------------------
def download_vctk(missing: list[dict]) -> None:
    """missing: speaker dicts (corpus=vctk) lacking clips. Pull from the
    sanchit-gandhi/vctk parquet mirror — American speakers live in the late
    shards, so we scan from the midpoint until each target has N_CLIPS."""
    from huggingface_hub import hf_hub_download, list_repo_files
    import pyarrow.parquet as pq

    need = {m["vid"]: m["key"] for m in missing}
    if not need:
        return
    print(f"  ↓ VCTK: downloading {sorted(need.values())}")
    files = sorted(f for f in list_repo_files("sanchit-gandhi/vctk", repo_type="dataset")
                   if f.endswith(".parquet") and "train" in f.lower())
    got: collections.Counter = collections.Counter()
    for fp in files[len(files) // 2:]:
        if not need:
            break
        path = hf_hub_download("sanchit-gandhi/vctk", fp, repo_type="dataset")
        d = pq.read_table(path).to_pydict()
        for sid, au in zip(d["speaker_id"], d["audio"]):
            v = re.sub(r"\D", "", str(sid))
            if v in need and got[v] < N_CLIPS:
                b = au.get("bytes") if isinstance(au, dict) else None
                if not b:
                    continue
                (CLIPS / f"{need[v]}_{got[v]}.flac").write_bytes(b)
                got[v] += 1
        need = {v: k for v, k in need.items() if got[v] < N_CLIPS}
    if need:
        print(f"  ⚠️  VCTK not found for {sorted(need.values())}")


def download_arctic(spk: str) -> bool:
    """Best-effort: fetch a CMU ARCTIC speaker release + extract N_CLIPS wavs."""
    url = f"http://festvox.org/cmu_arctic/packed/cmu_us_{spk}_arctic-0.95-release.tar.bz2"
    tar = CACHE / f"arctic_{spk}.tar.bz2"
    try:
        print(f"  ↓ ARCTIC: {spk}")
        subprocess.run(["curl", "-fsSL", url, "-o", str(tar)], check=True, timeout=180)
        subprocess.run(["tar", "xf", str(tar), "-C", str(CACHE)], check=True)
        wavs = sorted((CACHE / f"cmu_us_{spk}_arctic" / "wav").glob("*.wav"))[:N_CLIPS]
        for i, w in enumerate(wavs):
            shutil.copy2(w, CLIPS / f"arctic_{spk}_{i}.wav")
        return bool(wavs)
    except Exception as e:  # noqa: BLE001
        print(f"  ⚠️  ARCTIC {spk} failed ({e!r}) — skipping")
        return False


# ---- measure + build ------------------------------------------------------
def mean(xs: list) -> float | None:
    xs = [x for x in xs if x is not None]
    return round(statistics.fmean(xs), 2) if xs else None


def measure(clips: list[Path]) -> dict:
    """Average analyze() over a speaker's clips."""
    mets = []
    for c in clips:
        try:
            mets.append(analyze(parselmouth.Sound(str(to_wav_mono(c)))))
        except Exception as e:  # noqa: BLE001
            print(f"    skip {c.name}: {e!r}")
    if not mets:
        return {}

    def avg(*path):
        vals = []
        for m in mets:
            d = m
            for k in path:
                d = d.get(k) if isinstance(d, dict) else None
            vals.append(d)
        return mean(vals)

    return {
        "pitch": {"mean_hz": avg("pitch", "mean_hz"), "sd_hz": avg("pitch", "sd_hz")},
        "formants": {"f1_hz": avg("formants", "f1_hz"),
                     "f2_hz": avg("formants", "f2_hz"),
                     "f3_hz": avg("formants", "f3_hz")},
        "intensity": {"mean_db": avg("intensity", "mean_db")},
        "voice_quality": {"hnr_db": avg("voice_quality", "hnr_db"),
                          "jitter_pct": avg("voice_quality", "jitter_pct")},
        "weight": {"h1a3c_db": avg("weight", "h1a3c_db")},
    }


def make_preview(key: str, clips: list[Path]) -> None:
    """Concatenate a speaker's clips (0.35s gaps) → reference-audio/<key>.mp3."""
    inputs: list[str] = []
    for c in clips:
        inputs += ["-i", str(c)]
    inputs += ["-f", "lavfi", "-t", "0.35",
               "-i", "anullsrc=channel_layout=mono:sample_rate=44100"]
    n = len(clips)
    parts = [f"[{i}:a]aresample=44100[a{i}]" for i in range(n)]
    if n > 1:
        parts.append(f"[{n}:a]asplit={n - 1}" + "".join(f"[s{j}]" for j in range(n - 1)))
    seq = []
    for i in range(n):
        seq.append(f"[a{i}]")
        if i < n - 1:
            seq.append(f"[s{i}]")
    parts.append("".join(seq) + f"concat=n={2 * n - 1}:v=0:a=1[out]")
    subprocess.run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(parts),
                    "-map", "[out]", "-ac", "1", "-ar", "44100", "-b:a", "96k",
                    str(REF_AUDIO / f"{key}.mp3")], check=True, capture_output=True)


def suggest_zones(name: str, fem: list[float], masc: list[float], fem_high: bool) -> None:
    """Print suggested 3-band thresholds so the female mean lands in the fem
    band and the male mean in the masc band, with a neutral band between."""
    fm, mm = statistics.fmean(fem), statistics.fmean(masc)
    lo_end = round(mm + (fm - mm) * 0.33)
    hi_start = round(mm + (fm - mm) * 0.66)
    print(f"  {name}: F mean {fm:.0f} [{min(fem):.0f}..{max(fem):.0f}]  "
          f"M mean {mm:.0f} [{min(masc):.0f}..{max(masc):.0f}]")
    if fem_high:  # higher = feminine (F2, F3)
        print(f"    → MASC <{lo_end} · NEUTRAL {lo_end}-{hi_start} · FEM {hi_start}+")
    else:  # lower = feminine (weight h1a3c)
        lo_end, hi_start = round(mm - (mm - fm) * 0.66), round(mm - (mm - fm) * 0.33)
        print(f"    → FEM <{lo_end} · NEUTRAL {lo_end}-{hi_start} · MASC {hi_start}+")


def main() -> None:
    CLIPS.mkdir(parents=True, exist_ok=True)
    REF_AUDIO.mkdir(parents=True, exist_ok=True)
    sp = registry()

    # 1) download any missing clips
    missing_vctk = [s for s in sp if s["corpus"] == "vctk" and not clips_for(s["key"])]
    download_vctk(missing_vctk)
    for s in sp:
        if s["corpus"] == "arctic" and not clips_for(s["key"]):
            download_arctic(s["spk"])

    # 2) measure + build entries + previews
    refs, by_gender = [], collections.defaultdict(lambda: collections.defaultdict(list))
    for s in sp:
        clips = clips_for(s["key"])
        if not clips:
            print(f"  ⚠️  no clips for {s['key']} — skipped")
            continue
        m = measure(clips)
        if not m:
            continue
        make_preview(s["key"], clips)
        refs.append({"label": s["label"], "gender": s["gender"], "source": s["source"],
                     "audio": f"reference-audio/{s['key']}.mp3", **m})
        for metric, val in (("f2", m["formants"]["f2_hz"]), ("f3", m["formants"]["f3_hz"]),
                            ("weight", m["weight"]["h1a3c_db"])):
            if val is not None:
                by_gender[metric][s["gender"]].append(val)
        print(f"  ✓ {s['key']:14s} F2={m['formants']['f2_hz']} "
              f"F3={m['formants']['f3_hz']} weight={m['weight']['h1a3c_db']}")

    refs.sort(key=lambda r: (r["gender"], r["label"]))
    import json
    REF_JSON.write_text(json.dumps(refs, indent=2))
    nf = sum(r["gender"] == "f" for r in refs)
    nm = sum(r["gender"] == "m" for r in refs)
    print(f"\n🌸 wrote {len(refs)} reference voices ({nf} F / {nm} M) → {REF_JSON}")
    print("\n=== suggested zone thresholds (drop into zones.ts) ===")
    suggest_zones("F2", by_gender["f2"]["f"], by_gender["f2"]["m"], fem_high=True)
    suggest_zones("F3", by_gender["f3"]["f"], by_gender["f3"]["m"], fem_high=True)
    suggest_zones("WEIGHT", by_gender["weight"]["f"], by_gender["weight"]["m"], fem_high=False)


if __name__ == "__main__":
    main()
