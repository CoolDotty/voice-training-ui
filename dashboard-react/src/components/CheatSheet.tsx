import { useState } from "react";
import { RichText } from "./RichText";

// Real React collapsible (controlled <details>-style) for the cheat sheet.
export function CheatSheet() {
  const [open, setOpen] = useState(false);
  return (
    <details className="cheat" open={open}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        tap to open your gentle cheat sheet 🌸
      </summary>
      <div className="gloss">
        <div className="gloss-item">
          <h4>🎵 Pitch (avg F0)</h4>
          <p>
            The average highness of your voice — the single biggest cue people
            hear.
          </p>
          <div className="guide">
            masc &lt;145 · neutral 145–165 · <b>feminine 165 Hz+</b>
          </div>
          <div className="tip">
            💗 To raise it: think "light &amp; forward," let your voice float up
            a touch. Don't force it from the throat.
          </div>
        </div>

        <div className="gloss-item">
          <h4>🌊 Pitch range &amp; variability</h4>
          <p>
            How far your pitch travels (range) and how much it dances around
            (variability/SD). Flat = monotone; lively = expressive.
          </p>
          <div className="guide">
            variability: flat &lt;20 · <b>natural 20–40</b> · expressive 40+ Hz
          </div>
          <div className="tip">
            💗 Feminine speech tends to be more melodic. Read with feeling — let
            questions rise, add gentle ups &amp; downs.
          </div>
        </div>

        <div className="gloss-item">
          <h4>✨ Resonance (F2 &amp; formants)</h4>
          <p>
            Formants are the brightness of your voice — they signal vocal-tract{" "}
            <i>size</i>. This is what makes a voice read "small &amp; light" vs
            "big," independent of pitch. Now measured as the <b>median over your
            vowel nuclei</b> (loud, steady syllable cores), not every frame — so
            it separates voices more cleanly.
          </p>
          <div className="guide">
            F2: deeper &lt;1330 · mid 1330–1500 · <b>bright 1500 Hz+</b> (real
            women avg ~1434, men ~1281; still varies by vowel)
          </div>
          <div className="tip">
            💗 To brighten: smile slightly, lift the voice toward the front of
            your mouth / "mask," shrink the throat space.
          </div>
        </div>

        <div className="gloss-item">
          <h4>📣 Loudness (intensity)</h4>
          <p>
            How present and projected your voice is. Your current focus! Soft
            voices can read timid; a confident volume carries.
          </p>
          <div className="guide">
            soft 45–55 · comfy 55–65 · <b>strong 65 dB+</b>
          </div>
          <div className="tip">
            💗 Support from the breath/belly, not the throat — push more air, not
            more strain. (Note: depends on mic distance too.)
          </div>
        </div>

        <div className="gloss-item">
          <h4>🫧 Clarity (HNR)</h4>
          <p>
            Harmonics-to-noise ratio — how clear vs. breathy/noisy your voice is.
            Higher = clearer.
          </p>
          <div className="guide">
            breathy &lt;10 · clear-ish 10–18 · <b>clear 18 dB+</b>
          </div>
          <div className="tip">
            💗 A <i>little</i> breathiness can read feminine, but too much loses
            clarity &amp; tires you out. Aim for easy, clear tone.
          </div>
        </div>

        <div className="gloss-item">
          <h4>
            <RichText>🎯 Steadiness (jitter &amp; shimmer)</RichText>
          </h4>
          <p>
            Tiny wobbles in pitch (jitter) and loudness (shimmer)
            cycle-to-cycle. Lower = steadier, more controlled.
          </p>
          <div className="guide">
            jitter: <b>steady &lt;1%</b> · okay 1–2% · rough 2%+ &nbsp;|&nbsp;
            shimmer: steady &lt;3.8%
          </div>
          <div className="tip">
            💗 Steadiness improves with warm-ups &amp; not straining. If these
            spike, your voice is probably working too hard.
          </div>
        </div>

        <div className="gloss-item">
          <h4>🪶 Weight (source spectral tilt, corrected H1*–A3*)</h4>
          <p>
            The <i>thickness</i> of the voice itself — how heavy &amp; pressed vs.
            light &amp; airy it sounds. Measured as <b>corrected H1*–A3*</b> (the
            Iseli–Alwan source-tilt measure): on voiced frames only, the harmonic
            near your pitch (H1) minus the harmonic near F3 (A3), each{" "}
            <b>formant-corrected</b> so it isolates the <b>source</b> (your vocal
            folds, how they vibrate) from the <b>filter</b> (the shape of your
            throat &amp; mouth). A steeper roll-off — a <i>smaller</i> H1*–A3* —
            reads lighter &amp; more feminine; a flatter, larger value reads
            heavier. Gain-independent, so it's truly <i>comparable take-to-take</i>{" "}
            (unlike raw loudness dB).
          </p>
          <div className="guide">
            <b>light &lt;9</b> · overlap 9–12.5 · heavy 12.5 dB+ (smaller =
            lighter)
          </div>
          <div className="tip">
            💗 To lighten: let the folds come together gently — easy, breath-flowy
            tone, never pressed or squeezed. Lighter is the reliable direction;
            there's no magic number.
          </div>
        </div>

        <p className="gloss-note">
          🌸 Honest note: jitter, shimmer &amp; HNR norms come from sustained
          vowels, so on a full passage like the Rainbow they'll look "worse" than
          the textbook numbers — that's normal. Use them to spot{" "}
          <b>your own trend</b> over time, not as pass/fail. And remember: every
          metric is a hint, not a verdict. How your voice <i>feels</i> and how
          listeners <i>read</i> it are the real goals. 💗
        </p>
      </div>
    </details>
  );
}
