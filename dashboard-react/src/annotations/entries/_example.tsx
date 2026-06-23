/* ============================================================================
 * EXAMPLE / TEMPLATE — how to author a recording's annotations.
 *
 * This file is NOT rendered: the loader (../AnnotationsProvider) only loads
 * `entries/<NNN>.tsx` where <NNN> is a recording's zero-padded id (001, 002…).
 * Because this file is named `_example`, no recording id ever maps to it — it
 * exists purely as a copy-me reference. It still type-checks, so it can't rot.
 *
 * TO AUTHOR A REAL ONE: copy this to `entries/00N.tsx` (matching the recording's
 * id), then fill in only the slots you want. Everything you DON'T provide falls
 * back to the dashboard's built-in defaults — that's what keeps this DRY (the
 * page layout lives once; you only write the bespoke bits per take).
 *
 * The full workflow (run analyzer → interpret → author this file) is documented
 * in the `analyze-voice` skill (.claude/skills/analyze-voice/SKILL.md). Read it.
 * ========================================================================== */

import type { RecordingAnnotations } from "../types";
// Reusable building blocks. Grow this library (../lib) when an insight needs a
// new viz that could be reused — don't bury reusable charts in one entry.
import { InsightCard, Drill, PhraseEndingStrip, StatCompare } from "../lib";
import { fmt } from "../../zones";

/* Each slot is `(ctx) => ReactNode`, where ctx = { recording, detail }.
 * - recording: the full Recording (pitch/formants/voice_quality/intensity/
 *   weight/register summary). See ../types.ts.
 * - detail: the heavy per-frame/per-phrase analysis (frames, phrases, summary),
 *   loaded from public/analysis/<id>.json. May be null while loading — guard it.
 *
 * AVAILABLE SLOTS:
 *   Override notes (replace a built-in woven note; default shows if you omit it):
 *     note.pitch · note.loudness · note.resonance · note.register
 *   Freeform insertion regions (render nothing unless you fill them):
 *     region.top · region.afterLatest · region.afterResonance ·
 *     region.afterRegister · region.insights (the main one) · region.bottom
 *   Need a slot somewhere new? Add a <Note id> / <Region id> in the layout
 *   (App.tsx or a component) and document it here.
 *
 * CONVENTIONS (non-negotiable — see CLAUDE.md):
 *   Color rule: blue (MASC) = masculine / fell-out-of-register ONLY, never a
 *   generic "bad". pink (FEM) = good/feminine, butter = neutral, GROW = neutral
 *   "room to grow" for non-gendered skill gaps. Components use the automatic JSX
 *   runtime — do NOT import React. Tone: warm, specific, "a compass not a judge".
 */
const annotations: RecordingAnnotations = {
  slots: {
    // 1) Override a woven note, personalized for this take:
    "note.pitch": ({ recording }) => (
      <>
        {fmt(recording.pitch.mean_hz)} Hz this take — say something specific and
        encouraging about where their pitch landed 💕
      </>
    ),

    // 2) The main insight, dropped into the dedicated insights section:
    "region.insights": ({ recording, detail }) => {
      const reg = recording.register;
      if (!reg || !detail) return null; // guard: detail loads async
      return (
        <InsightCard
          title="One clear, clockable headline for this take 🎯"
          subtitle="More specific than generic advice — name the moment + the fix."
          badges={[
            `${fmt(reg.offset_sub_pct)}% sub-register at endings`,
            `melody ${fmt(reg.in_register_semitones_sd)} st`,
          ]}
        >
          <p>
            A short, honest paragraph interpreting the numbers like a phonetician
            — what's working, what the lead issue is, and why.
          </p>

          {/* Reusable viz from ../lib. PhraseEndingStrip plots phrase endings vs
              the register floor; StatCompare contrasts this take with another. */}
          <PhraseEndingStrip detail={detail} />
          <StatCompare
            rows={[
              { label: "pitch", a: recording.pitch.mean_hz, b: 165, unit: "Hz" },
            ]}
          />

          <Drill title="A concrete thing to practice">
            One specific, doable exercise tied to the finding.
          </Drill>

          <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)" }}>
            End warm and forward-looking — a finishing move, not a rebuild. 🌸
          </p>
        </InsightCard>
      );
    },
  },
};

export default annotations;
