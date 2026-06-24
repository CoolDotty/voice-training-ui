import { useMemo, useState } from "react";
import type { Recording } from "../types";
import { fmt } from "../zones";
import { CardsIcon } from "./icons";
import { RecordingCard } from "./RecordingCard";

type HistoryFilter = "all" | "local" | "files";
type HistorySort = "newest" | "oldest" | "pitch" | "register";

interface RecordingHistoryProps {
  recordings: Recording[];
  activeId: number | null;
  latestId: number | null;
  onSelect: (id: number) => void;
  onDelete: (recording: Recording) => void;
  onEdit: (recording: Recording) => void;
}

export function RecordingHistory({
  recordings,
  activeId,
  latestId,
  onSelect,
  onDelete,
  onEdit,
}: RecordingHistoryProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [sort, setSort] = useState<HistorySort>("newest");

  const active = recordings.find((recording) => recording.id === activeId) ?? null;
  const localCount = recordings.filter((recording) => recording.isLocal).length;
  const fileCount = recordings.length - localCount;

  const visibleRecordings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recordings
      .filter((recording) => {
        if (filter === "local" && !recording.isLocal) return false;
        if (filter === "files" && recording.isLocal) return false;
        if (!normalizedQuery) return true;

        const searchable = [
          recording.id,
          recording.label,
          recording.note,
          recording.date,
          recording.source_file,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => compareRecordings(a, b, sort));
  }, [filter, query, recordings, sort]);

  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="history-heading-row">
        <div>
          <h2 className="section-title" id="history-title">
            <CardsIcon /> Recording history
          </h2>
          <div className="history-counts" aria-label="Recording counts">
            <span>{recordings.length} total</span>
            <span>{localCount} browser</span>
            <span>{fileCount} files</span>
          </div>
        </div>
        {active && (
          <div className="history-active-pill" aria-live="polite">
            Viewing #{active.id}
          </div>
        )}
      </div>

      <div className="history-toolbar">
        <label className="history-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            placeholder="Label, note, date, or #"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="history-filter" role="group" aria-label="Recording source">
          {(["all", "local", "files"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "is-active" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filterLabel(value)}
            </button>
          ))}
        </div>

        <label className="history-sort">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as HistorySort)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="pitch">Highest pitch</option>
            <option value="register">Best register</option>
          </select>
        </label>
      </div>

      {active && (
        <div className="history-current" aria-label="Current recording summary">
          <div>
            <span className="history-kicker">Current take</span>
            <h3>
              #{active.id} {active.label}
            </h3>
            <p>
              {active.date} - {fmt(active.duration_s, "s")}
              {active.isLocal ? " - browser recording" : " - file recording"}
            </p>
          </div>
          <div className="history-current-metrics" aria-label="Current recording metrics">
            <span>
              <b>{fmt(active.pitch.mean_hz)}</b>
              Pitch Hz
            </span>
            <span>
              <b>{fmt(active.formants.f2_hz)}</b>
              F2 Hz
            </span>
            <span>
              <b>{fmt(active.register?.in_register_pct, "%")}</b>
              In register
            </span>
          </div>
        </div>
      )}

      <div className="rec-grid">
        {recordings.length === 0 ? (
          <div className="empty">
            no recordings yet
            <br />
            record a browser take or add analyzer output to get started.
          </div>
        ) : visibleRecordings.length === 0 ? (
          <div className="empty">No recordings match the current view.</div>
        ) : (
          visibleRecordings.map((recording) => (
            <RecordingCard
              key={recording.id}
              r={recording}
              selected={recording.id === activeId}
              isLatest={recording.id === latestId}
              onSelect={() => onSelect(recording.id)}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </section>
  );
}

function compareRecordings(a: Recording, b: Recording, sort: HistorySort) {
  if (sort === "oldest") return a.id - b.id;
  if (sort === "pitch") return compareMetricDesc(a, b, (recording) => recording.pitch.mean_hz);
  if (sort === "register") {
    return compareMetricDesc(a, b, (recording) => recording.register?.in_register_pct);
  }
  return b.id - a.id;
}

function compareMetricDesc(
  a: Recording,
  b: Recording,
  readValue: (recording: Recording) => number | null | undefined,
) {
  const aValue = readValue(a);
  const bValue = readValue(b);
  const aHasValue = isFiniteNumber(aValue);
  const bHasValue = isFiniteNumber(bValue);

  if (aHasValue && bHasValue) return bValue - aValue;
  if (aHasValue) return -1;
  if (bHasValue) return 1;
  return b.id - a.id;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function filterLabel(filter: HistoryFilter) {
  if (filter === "local") return "Browser";
  if (filter === "files") return "Files";
  return "All";
}
