import type { Recording } from "../types";
import { fmt } from "../zones";
import { WaveformPlayer } from "./WaveformPlayer";

export function RecordingCard({ r }: { r: Recording }) {
  return (
    <div className="rec">
      <div className="top">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="num">{r.id}</span>
          <span className="label-txt">{r.label}</span>
        </div>
        <span className="date">
          {r.date} · {fmt(r.duration_s, "s")}
        </span>
      </div>
      <div className="metrics">
        <div className="chip">
          <b>{fmt(r.pitch.mean_hz)}</b>
          <span>pitch Hz</span>
        </div>
        <div className="chip">
          <b>
            {fmt(r.pitch.min_hz)}–{fmt(r.pitch.max_hz)}
          </b>
          <span>range Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.formants.f2_hz)}</b>
          <span>F2 Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.intensity.mean_db)}</b>
          <span>loud dB</span>
        </div>
        <div className="chip">
          <b>{fmt(r.pitch.sd_hz)}</b>
          <span>variab Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.voice_quality.hnr_db)}</b>
          <span>HNR dB</span>
        </div>
      </div>
      {r.note && <div className="note">📝 {r.note}</div>}
      {r.audio && (
        <WaveformPlayer
          src={r.audio}
          duration={r.duration_s}
          downloadName={`voice-take-${r.id}`}
        />
      )}
    </div>
  );
}
