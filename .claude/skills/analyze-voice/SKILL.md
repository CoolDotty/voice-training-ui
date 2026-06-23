---
name: analyze-voice
description: Analyze one of Rachel's voice-training recordings end to end — run the parselmouth analyzer, intelligently interpret the results, and author per-recording "annotations" (a custom insight + woven-in personalized notes) that surface the most important specific thing to work on. Use whenever Rachel shares a new recording, points at an audio file to analyze, or asks how a take went / what to work on next.
---

# Analyze Rachel's voice (Voice Garden)

**Voice Garden** is a voice-feminization training tracker. Rachel records herself (usually
the Rainbow Passage), tells you what she was practicing, and you analyze it. There are
**two layers** and your job spans both:

1. **Standard analysis** → permanent, data-driven dashboard cards + the permanent
   "🎚️ Register & phrasing" visualizer. Fully automated by `analyze.py` — you just run it.
2. **Intelligent, per-recording annotations** → you read the detailed data, find the single
   most important, specific, *clockable* thing to work on, and author it as custom UI: a big
   insight in the "🔍 Insights for this take" section, plus optional personalized woven notes.

Read `CLAUDE.md` for the full vibe/design. Keep everything **warm, specific, and comforting**
("Animal Crossing girliepop"). Numbers are *a compass, not a judge.* Be honest about
weaknesses, always actionable and kind.

---

## Step 1 — Run the standard analyzer

```fish
cd /Users/rachel/Downloads/voice-training
uv run analyze.py "<path to audio>" --label "<what she was practicing>" [--note "..."] [--register-floor 130]
```

- Always pass `--label` (her stated focus). Ask if she didn't say.
- Python is managed with **uv**, never pip. If you edit `analyze.py`, run `uvx ruff check .`
  and keep it clean.
- Writes (additive, idempotent per id): `recordings.json` (+ mirror in
  `dashboard-react/public/`), `public/analysis/<id>.json` (heavy detail), `public/audio/<id>`.
- Note the new **id** (printed as `entry #N`) — it's the annotation filename.

## Step 2 — Read the detailed data

Read `dashboard-react/public/analysis/<id>.json` and the new entry in `recordings.json`.
Shapes are in `dashboard-react/src/types.ts`:
- `Recording.register`: `in_register_pct`, `semitones_sd` (raw, inflated), `in_register_semitones_sd`
  (honest melody), `onset_sub_pct`/`mid_sub_pct`/`offset_sub_pct`, `phrases_landed_pct`,
  `n_phrases`, `floor_hz`.
- `RecordingDetail`: `frames {t[],hz[]}` (hz null when unvoiced), `phrases[]`
  (`start/end/onset_hz/offset_hz/min_hz/started_in_register/ended_in_register/sub_register_pct`).
- Standard metrics: `pitch`, `formants`, `voice_quality`, `intensity`.
- If there's history, read prior entries to compare trends.

## Step 3 — Interpret intelligently (think, don't just report)

Find the **1–3 most important, most actionable** things — beat generic advice like
"add melody." Reason like a phonetician. Check, roughly by leverage:
- **Register & phrase boundaries.** Is "lively prosody" real, or register crashes? Compare
  `semitones_sd` vs `in_register_semitones_sd`. Where do drops cluster (onset/mid/offset)?
  Which phrases fell out (`ended_in_register === false`)? Trailing-off endings are very clockable.
- **Pitch.** Mean vs the feminine threshold (~165 Hz). In-register melody flat (< ~2 st) or healthy (~3–4 st)?
- **Resonance.** F2/F3 deeper/neutral/bright (`zones.ts`). Often the biggest lever after pitch.
- **Voice quality.** Excess breathiness (low HNR) or strain (high jitter/shimmer).
- **Her stated `--label` goal** — speak to it directly.

Pick the lead finding. Name the moment, the number, the fix.

## Step 4 — Author the recording's annotations

Create **`dashboard-react/src/annotations/entries/<NNN>.tsx`** (`<NNN>` = zero-padded id;
id 2 → `002.tsx`). Default-export a `RecordingAnnotations` ({ slots }). Auto-discovered via
Vite `import.meta.glob` — no registry edits. **Fill only the slots you want** for this take;
everything else falls back to shared defaults (this is what keeps it DRY).

Each slot is `(ctx) => ReactNode` where `ctx = { recording, detail }` (`detail` may be null
while loading — guard it). Slot kinds:
- **Override slots** (`note.*`) replace a woven-in default note. Available: `note.pitch`,
  `note.loudness`, `note.resonance`, `note.register`.
- **Insertion slots** (`region.*`) drop in freeform content; empty by default. Available:
  `region.top`, `region.afterLatest`, `region.afterResonance`, `region.afterRegister`,
  `region.insights` (put the main insight here), `region.bottom`.

Need a slot somewhere new? Add a `<Note id>`/`<Region id>` in the layout
(`src/App.tsx`, or inside a component like `ResonanceCard`/`RegisterSection`) and document it.

Reuse the library in **`src/annotations/lib/`** (import from `../lib`): `InsightCard`
(shell: title/subtitle/badges), `Drill` (a "try this" box), `PhraseEndingStrip` (per-phrase
ending dots vs the floor). **Grow the library:** if your finding needs a new viz that could
be reused, build it in `lib/`, export from `lib/index.ts`, then use it — don't bury reusable
viz in one entry. `entries/001.tsx` is the reference example. Helpers (`fmt`, colors, zones)
are in `../../zones`.

### Conventions (non-negotiable)
- **Color rule:** blue `MASC` (`#bcd3f0` / `#5e7fb8`) = masculine / fell-out-of-register ONLY,
  never generic "bad." Pink `FEM` = good, butter = neutral, `GROW` `#cdc6da` = non-gendered
  "room to grow" (breathy/rough/flat). A register crash *is* masculine register → blue is right.
- **Tone:** warm, specific, encouraging; tasteful emoji (🌸🎯💕). End affirming with a clear next
  step. Frame as a finishing move, not a rebuild, when she's close.
- **Honesty:** don't inflate progress. If the melody is a mirage, say so — kindly.

## Step 5 — Verify

```fish
cd /Users/rachel/Downloads/voice-training/dashboard-react
npm run build          # must pass (tsc -b && vite build)
```
`npm run dev` (http://localhost:5173/) hot-reloads new entries and re-fetches data on refresh.
The recording switcher (pills, or click a card under "All recordings") changes which take is
shown, loading that recording's annotations.

> Ignore false IDE errors like "Cannot find name 'React' / UMD global" or "Property
> 'glob'/'env' does not exist on ImportMeta" — the project uses the automatic JSX runtime and
> `vite/client` types. **Trust `npm run build`, not inline diagnostics.**

## File map
- `analyze.py` — analyzer (uv + ruff). `recordings.json` — source of truth.
- `dashboard-react/public/` — served data (`recordings.json`, `analysis/<id>.json`, `audio/`).
- `dashboard-react/src/types.ts` — data model. `src/zones.ts` — colors/zones/`fmt`.
- `src/components/RegisterSection.tsx`, `ContourChart.tsx` — permanent register viz.
- `src/annotations/AnnotationsProvider.tsx` — context + `Note`/`Region`. `src/annotations/lib/`
  — reusable viz. `src/annotations/entries/<NNN>.tsx` — per-recording annotations you author.
