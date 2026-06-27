import type { Recording } from "../types";
import { fmt } from "../zones";
import { WaveformPlayer } from "./WaveformPlayer";

export function RecordingCard({
  r,
  selected = false,
  isLatest = false,
  onSelect,
  onDelete,
  onEdit,
}: {
  r: Recording;
  selected?: boolean;
  isLatest?: boolean;
  onSelect?: (recording: Recording) => void;
  onDelete?: (recording: Recording) => void;
  onEdit?: (recording: Recording) => void;
}) {
  return (
    <article className={`rec${selected ? " is-selected" : ""}`} aria-current={selected ? "true" : undefined}>
      <div className="top">
        <div className="rec-title">
          <span className="num">{r.id}</span>
          <div>
            <div className="rec-name-row">
              <span className="label-txt">{r.label}</span>
              {selected && <span className="rec-badge rec-badge-current">Current</span>}
              {isLatest && <span className="rec-badge">Latest</span>}
              {r.isLocal && <span className="rec-badge rec-badge-local">Browser</span>}
              {r.audioBlobId && !r.isLocal && <span className="rec-badge rec-badge-file">File</span>}
            </div>
            <span className="date">
              {r.date} - {fmt(r.duration_s, "s")}
            </span>
          </div>
        </div>
        <div className="rec-actions">
          {onSelect && (
            <button
              className="select-recording"
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(r)}
            >
              {selected ? "Viewing" : "View"}
            </button>
          )}
          {r.audioBlobId && onEdit && (
            <button
              className="edit-local"
              type="button"
              onClick={() => onEdit(r)}
              title="Edit label and note"
            >
              Edit
            </button>
          )}
          {r.audioBlobId && onDelete && (
            <button
              className="delete-local"
              type="button"
              onClick={() => onDelete(r)}
              title="Delete this recording"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="metrics">
        <div className="chip">
          <b>{fmt(r.pitch.mean_hz)}</b>
          <span>Pitch Hz</span>
        </div>
        <div className="chip">
          <b>
            {fmt(r.pitch.min_hz)}-{fmt(r.pitch.max_hz)}
          </b>
          <span>Range Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.formants.f2_hz)}</b>
          <span>F2 Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.register?.in_register_pct, "%")}</b>
          <span>In register</span>
        </div>
        <div className="chip">
          <b>{fmt(r.pitch.sd_hz)}</b>
          <span>Melody Hz</span>
        </div>
        <div className="chip">
          <b>{fmt(r.voice_quality.hnr_db)}</b>
          <span>Clarity dB</span>
        </div>
      </div>
      {r.note && <div className="note">{r.note}</div>}
      {(r.audio || r.audioBlobId) && (
        <WaveformPlayer
          src={r.audio}
          audioBlobId={r.audioBlobId}
          duration={r.duration_s}
          downloadName={`voice-take-${r.id}`}
        />
      )}
    </article>
  );
}
