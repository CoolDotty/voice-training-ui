import { MASC, FEM, fmt } from "../zones";
import { ContourChart } from "./ContourChart";
import { useAnnotations, Note } from "../annotations/AnnotationsProvider";
import { RichText } from "./RichText";

// Permanent "Register & phrasing" visualizer. Reads the active recording and
// its heavy detail JSON from the annotations context (loaded once there), and
// shows the pitch contour, register-stability stats, and the phrase-boundary
// breakdown (where the voice falls out of register).
export function RegisterSection() {
  const { recording, detail } = useAnnotations();
  const reg = recording.register;

  if (!reg || !detail)
    return (
      <div className="empty">
        no register data for this take yet 🌱
        <br />
        re-run the analyzer to generate it
      </div>
    );

  // worst boundary position drives the default phrasing tip
  const positions = [
    { key: "onset", label: "phrase starts", v: reg.onset_sub_pct },
    { key: "mid", label: "mid-phrase", v: reg.mid_sub_pct },
    { key: "offset", label: "phrase endings", v: reg.offset_sub_pct },
  ];
  const worst = [...positions].sort((a, b) => (b.v ?? 0) - (a.v ?? 0))[0];

  return (
    <div className="register">
      <p className="res-desc">
        Pitch isn't just an average — it's a <b>contour</b> that moves through every phrase. This
        shows where your voice <b>falls out of register</b> (crashes below {reg.floor_hz} Hz, back
        toward chest voice). The{" "}
        <span style={{ color: "#5e7fb8", fontWeight: 700 }}>blue stretches</span> are the drops;
        watch where they cluster.
      </p>

      <div className="contour-card">
        <ContourChart detail={detail} />
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">
            <span>In-register time</span>
          </div>
          <div className="value">
            {fmt(reg.in_register_pct)}
            <small> %</small>
          </div>
          <div className="sub">
            share of voiced time held above the floor · higher = steadier register
          </div>
        </div>

        <div className="stat">
          <div className="label">
            <span>Phrase endings landed</span>
          </div>
          <div className="value">
            {fmt(reg.phrases_landed_pct)}
            <small> %</small>
          </div>
          <div className="sub">
            of your {reg.n_phrases} phrases ended <i>in</i> register (didn't trail off down low)
          </div>
        </div>

        <div className="stat">
          <div className="label">
            <span>True melody</span>
          </div>
          <div className="value">
            {fmt(reg.in_register_semitones_sd)}
            <small> st</small>
          </div>
          <div className="sub">
            in-register pitch variation. Raw looks like {fmt(reg.semitones_sd)} st, but the extra is
            register crashes, not melody — this is the honest number.
          </div>
        </div>
      </div>

      {/* phrase-position breakdown */}
      <div className="stat" style={{ marginTop: 16 }}>
        <div className="label">
          <span>Where the register drops happen</span>
        </div>
        <p className="sub" style={{ margin: "4px 0 14px" }}>
          % of voiced time spent <b>below the floor</b>, by position within a phrase. Taller bar =
          more crashing there.
        </p>
        <div className="posbars">
          {positions.map((p) => {
            const v = p.v ?? 0;
            const h = Math.max(4, Math.min(100, v * 3));
            return (
              <div className="posbar" key={p.key}>
                <div className="posbar-track">
                  <div className="posbar-fill" style={{ height: `${h}%`, background: MASC }} />
                </div>
                <div className="posbar-val">{fmt(p.v)}%</div>
                <div className="posbar-lbl">{p.label}</div>
              </div>
            );
          })}
        </div>
        <div className="res-summary" style={{ marginTop: 14, background: FEM + "22" }}>
          <Note id="note.register">
            <RichText>
              🎯 Your weakest spot is <b>{worst.label}</b> ({fmt(worst.v)}% sub-register). The most
              clockable goal: <b>land every phrase ending up in register</b> — don't let the last word
              trail down into chest voice.
            </RichText>
          </Note>
        </div>
      </div>
    </div>
  );
}
