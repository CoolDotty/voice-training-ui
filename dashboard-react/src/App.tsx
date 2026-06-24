import { useCallback, useEffect, useState } from "react";
import type { Recording, ReferenceVoice } from "./types";
import {
  PITCH_ZONES,
  LOUD_ZONES,
  SD_ZONES,
  HNR_ZONES,
  JITTER_ZONES,
  WEIGHT_ZONES,
  MELODY_ZONES,
  zoneOf,
  fmt,
} from "./zones";
import { StatCard } from "./components/StatCard";
import { MetricModal } from "./components/MetricModal";
import { METRICS, type MetricKey } from "./metrics";
import { ResonanceCard } from "./components/ResonanceCard";
import { LineChart, type Point, type ChartBand } from "./components/LineChart";
import { CheatSheet } from "./components/CheatSheet";
import { RegisterSection } from "./components/RegisterSection";
import { RecordingPanel } from "./components/RecordingPanel";
import { RecordingHistory } from "./components/RecordingHistory";
import {
  deleteLocalRecording,
  getLocalRecordings,
  updateLocalRecordingMetadata,
} from "./services/recordingStore";
import {
  AnnotationsProvider,
  Note,
  Region,
} from "./annotations/AnnotationsProvider";
import {
  TulipIcon,
  BowIcon,
  SparkleIcon,
  ContourIcon,
  InsightIcon,
  TrendsIcon,
  BulbIcon,
} from "./components/icons";

type AppPage = "record" | "detail" | "history";

export function App() {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState<AppPage>("record");
  const [references, setReferences] = useState<ReferenceVoice[]>([]);
  // which metric's reference modal is open + the card rect it grew from
  const [modal, setModal] = useState<{ key: MetricKey; rect: DOMRect } | null>(
    null,
  );

  const loadRecordings = useCallback(async (selectId?: number | null) => {
    try {
      const staticRecordings = await fetch(
        `${import.meta.env.BASE_URL}recordings.json?t=${Date.now()}`,
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: Recording[]) =>
          Array.isArray(data) ? data.map((r) => ({ ...r, isLocal: false })) : [],
        );
      const localRecordings = await getLocalRecordings();
      const merged = [...staticRecordings, ...localRecordings].sort(
        (a, b) => a.id - b.id,
      );
      setRecordings(merged);
      if (selectId !== undefined) setSelectedId(selectId);
      setError(null);
    } catch (e) {
      setError(String(e));
      try {
        const localRecordings = await getLocalRecordings();
        setRecordings(localRecordings);
      } catch {
        setRecordings([]);
      }
    }
  }, []);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  // reference voices (real men/women) — degrade gracefully if missing.
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}reference.json?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ReferenceVoice[]) =>
        setReferences(Array.isArray(data) ? data : []),
      )
      .catch(() => setReferences([]));
  }, []);

  const openModal = (key: MetricKey, rect: DOMRect) => setModal({ key, rect });

  const R = recordings ?? [];
  const latest = R.length ? R[R.length - 1] : null;
  const nextRecordingId = R.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  // the recording currently in focus (defaults to the latest)
  const active =
    (selectedId != null ? R.find((r) => r.id === selectedId) : null) ?? latest;
  const pz = active ? zoneOf(PITCH_ZONES, active.pitch.mean_hz) : null;
  const isLatest = active && latest && active.id === latest.id;

  const mk = (sel: (r: Recording) => number | null): Point[] =>
    R.map((r) => ({ label: r.id, y: sel(r) }));

  const handleSavedRecording = useCallback(
    (recording: Recording) => {
      setSelectedId(recording.id);
      setPage("detail");
      void loadRecordings(recording.id);
    },
    [loadRecordings],
  );

  const handleOpenRecording = useCallback((id: number) => {
    setSelectedId(id);
    setPage("detail");
  }, []);

  const handleDeleteLocal = useCallback(
    async (recording: Recording) => {
      if (!recording.isLocal) return;
      const confirmed = window.confirm(`Delete local take #${recording.id}?`);
      if (!confirmed) return;
      try {
        await deleteLocalRecording(recording);
        await loadRecordings(selectedId === recording.id ? null : selectedId);
      } catch (e) {
        setError(`Couldn't delete local recording: ${String(e)}`);
      }
    },
    [loadRecordings, selectedId],
  );

  const handleEditLocal = useCallback(
    async (recording: Recording) => {
      if (!recording.isLocal) return;
      const nextLabel = window.prompt("Label", recording.label);
      if (nextLabel == null) return;
      const nextNote = window.prompt("Note", recording.note);
      if (nextNote == null) return;
      try {
        await updateLocalRecordingMetadata(recording.id, {
          label: nextLabel.trim() || recording.label,
          note: nextNote.trim(),
        });
        await loadRecordings(recording.id);
      } catch (e) {
        setError(`Couldn't edit local recording: ${String(e)}`);
      }
    },
    [loadRecordings],
  );

  return (
    <div className="wrap">
      <header className="hero">
        <h1>
          <TulipIcon title="Voice Garden" /> Voice Garden
        </h1>
        <p>a cozy place to watch your voice bloom 🌱✨</p>
        {active && (
          <div className="latest-banner">
            🌸 <b>#{active.id}</b> &middot; {active.label} &middot;{" "}
            <span style={{ color: "#9d8ba8" }}>{active.date}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="empty">
          couldn't load recordings 🌧️
          <br />
          {error}
        </div>
      )}

      <AppNavigation
        page={page}
        active={active}
        recordingCount={R.length}
        onNavigate={setPage}
      />

      <main className="app-page">
        {page === "record" && (
          <section className="page-shell" aria-labelledby="record-page-title">
            <div className="page-head">
              <span className="page-kicker">New take</span>
              <h2 id="record-page-title">Record practice audio</h2>
              <p>
                Choose the exercise, set the register floor, record, review, and
                save the take for analysis.
              </p>
            </div>
            <RecordingPanel
              nextId={nextRecordingId}
              onSaved={handleSavedRecording}
            />
          </section>
        )}

        {page === "history" && (
          <section className="page-shell" aria-labelledby="history-page-title">
            <div className="page-head">
              <span className="page-kicker">Library</span>
              <h2 id="history-page-title">Recordings history</h2>
              <p>
                Search, compare, edit local takes, and open a recording when you
                want to inspect its analysis.
              </p>
            </div>
            <RecordingHistory
              recordings={R}
              activeId={active?.id ?? null}
              latestId={latest?.id ?? null}
              onSelect={handleOpenRecording}
              onDelete={handleDeleteLocal}
              onEdit={handleEditLocal}
            />
          </section>
        )}

        {page === "detail" && !active && (
          <section className="page-shell">
            <div className="empty detail-empty">
              No recording selected yet.
              <div className="empty-actions">
                <button type="button" onClick={() => setPage("history")}>
                  Browse history
                </button>
                <button type="button" onClick={() => setPage("record")}>
                  Record a take
                </button>
              </div>
            </div>
          </section>
        )}

        {page === "detail" && active && (
        <AnnotationsProvider recording={active}>
          <Region id="region.top" />

          {/* 🎀 This take */}
          <section>
            <h2 className="section-title">
              <BowIcon /> {isLatest ? "Latest take" : `Take #${active.id}`}
            </h2>
            <p className="take-hint">
              🔍 tap any card with a colored bar to see how you compare to real
              voices
            </p>
            <div className="stat-grid">
              <StatCard
                title="Pitch (avg)"
                value={active.pitch.mean_hz}
                unit="Hz"
                zones={PITCH_ZONES}
                lo={100}
                hi={260}
                metricKey="pitch"
                onExpand={openModal}
                sub={
                  <Note id="note.pitch">
                    {pz ? (
                      <>
                        you're in the <b>{pz.name}</b> zone — 165 Hz+ reads
                        feminine to most ears 💕
                      </>
                    ) : (
                      ""
                    )}
                  </Note>
                }
              />
              <StatCard
                title="Pitch range"
                value={active.pitch.range_hz}
                unit="Hz"
                sub={
                  <>
                    {fmt(active.pitch.min_hz)}–{fmt(active.pitch.max_hz)} Hz ·
                    wider = more melodic & expressive
                  </>
                }
              />
              <StatCard
                title="Loudness"
                value={active.intensity.mean_db}
                unit="dB"
                zones={LOUD_ZONES}
                lo={45}
                hi={78}
                metricKey="loudness"
                onExpand={openModal}
                sub={
                  <Note id="note.loudness">
                    louder = more present & confident 📣
                  </Note>
                }
              />
              <StatCard
                title="Pitch variability"
                value={active.pitch.sd_hz}
                unit="Hz"
                zones={SD_ZONES}
                lo={0}
                hi={60}
                metricKey="sd"
                onExpand={openModal}
                sub="how much your melody moves · ~20–40 Hz is lively, natural speech"
              />
              <StatCard
                title="Clarity (HNR)"
                value={active.voice_quality.hnr_db}
                unit="dB"
                zones={HNR_ZONES}
                lo={0}
                hi={30}
                metricKey="hnr"
                onExpand={openModal}
                sub="higher = clearer, lower = breathier · runs lower on full passages than a held vowel"
              />
              <StatCard
                title="Steadiness (jitter)"
                value={active.voice_quality.jitter_pct}
                unit="%"
                zones={JITTER_ZONES}
                lo={0}
                hi={3}
                metricKey="jitter"
                onExpand={openModal}
                sub={
                  <>
                    lower = steadier · shimmer{" "}
                    {fmt(active.voice_quality.shimmer_pct)}% (under ~3.8% is
                    steady)
                  </>
                }
              />
              <StatCard
                title="Weight"
                value={active.weight?.h1a3c_db ?? null}
                unit="dB"
                zones={WEIGHT_ZONES}
                lo={0}
                hi={20}
                metricKey="weight"
                onExpand={openModal}
                sub={
                  <Note id="note.weight">
                    source spectral tilt (corrected H1*–A3*) — the <i>thickness</i>{" "}
                    of the voice itself (separate from pitch & resonance) · lighter
                    leans feminine. <b>Heads up:</b> weight is hard to pin to a
                    gender across people (lots of overlap), so it's most useful as{" "}
                    <b>your own change over time</b>, not a vs-others verdict.
                  </Note>
                }
              />
            </div>
          </section>

          <Region id="region.afterLatest" />

          {/* ✨ Resonance */}
          <section>
            <h2 className="section-title">
              <SparkleIcon /> Resonance{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-soft)" }}>
                · the "size" your voice sounds, separate from pitch
              </span>
            </h2>
            <ResonanceCard r={active} onExpand={openModal} />
          </section>

          <Region id="region.afterResonance" />

          {/* 🎚️ Register & phrasing */}
          <section>
            <h2 className="section-title">
              <ContourIcon /> Register &amp; phrasing{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-soft)" }}>
                · where your voice holds vs. falls out of register
              </span>
            </h2>
            <RegisterSection />
          </section>

          <Region id="region.afterRegister" />

          {/* 🔍 Insights for this take */}
          <section>
            <h2 className="section-title">
              <InsightIcon /> Insights for this take{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-soft)" }}>
                · custom analysis of what to work on next
              </span>
            </h2>
            <Region
              id="region.insights"
              empty={
                <div className="insight-placeholder">
                  ✍️ no custom insight written for take #{active.id} yet.
                  <br />
                  ask Claude to "analyze this recording" — it'll design one right
                  here.
                </div>
              }
            />
          </section>

          <Region id="region.bottom" />
        </AnnotationsProvider>
      )}

      {/* 📈 Trends over time (across all recordings) */}
      {page === "history" && (
      <section>
        <h2 className="section-title">
          <TrendsIcon /> Trends over time
        </h2>
        <div className="chart-grid">
          {R.length < 2 && (
            <p className="cap" style={{ gridColumn: "1/-1", margin: "0 0 4px" }}>
              add another recording to watch the lines grow 🌱
            </p>
          )}
          <ChartCard
            h="Pitch (avg)"
            cap="pink band = feminine zone (165 Hz+)"
            color="#e07ab0"
            data={mk((r) => r.pitch.mean_hz)}
            band={[165, 260]}
            bandColor="#ffb6d5"
          />
          <ChartCard
            h="In-register melody"
            cap="true expressiveness, crashes removed (st)"
            color="#9b7ad0"
            data={mk((r) => r.register?.in_register_semitones_sd ?? null)}
            bands={MELODY_ZONES}
          />
          <ChartCard
            h="Phrase endings landed"
            cap="% of phrases that stayed in register"
            color="#5fb89a"
            data={mk((r) => r.register?.phrases_landed_pct ?? null)}
            band={[80, 100]}
            bandColor="#b8ecd8"
          />
          <ChartCard
            h="Resonance (F2)"
            cap="brightness / vocal-tract size cue"
            color="#d99a4e"
            data={mk((r) => r.formants.f2_hz)}
            band={[1850, 2400]}
            bandColor="#c9b6ff"
          />
          <ChartCard
            h="Weight"
            cap="spectral tilt · lower = lighter / more feminine"
            color="#cf7fb0"
            data={mk((r) => r.weight?.h1a3c_db ?? null)}
            bands={WEIGHT_ZONES}
          />
        </div>
      </section>
      )}

      {/* 💡 Cheat sheet */}
      {page === "detail" && (
      <section>
        <h2 className="section-title">
          <BulbIcon /> What do these mean?
        </h2>
        <CheatSheet />
      </section>
      )}

      </main>

      <footer>
        made with 🩷 &middot; numbers are a compass, not a judge &middot; your ears
        matter most
      </footer>

      {modal && (
        <MetricModal
          metric={METRICS[modal.key]}
          recordings={R}
          references={references}
          activeId={active?.id ?? null}
          origin={modal.rect}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function AppNavigation({
  page,
  active,
  recordingCount,
  onNavigate,
}: {
  page: AppPage;
  active: Recording | null;
  recordingCount: number;
  onNavigate: (page: AppPage) => void;
}) {
  const items: Array<{ id: AppPage; label: string; meta: string }> = [
    { id: "record", label: "Record", meta: "New take" },
    {
      id: "detail",
      label: "Detail",
      meta: active ? `#${active.id}` : "No take",
    },
    {
      id: "history",
      label: "History",
      meta: `${recordingCount} saved`,
    },
  ];

  return (
    <nav className="app-nav" aria-label="Main sections">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={page === item.id ? "is-active" : ""}
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.label}</span>
          <small>{item.meta}</small>
        </button>
      ))}
    </nav>
  );
}

interface ChartCardProps {
  h: string;
  cap: string;
  color: string;
  data: Point[];
  band?: [number, number];
  bandColor?: string;
  bands?: ChartBand[];
}

function ChartCard({ h, cap, color, data, band, bandColor, bands }: ChartCardProps) {
  return (
    <div className="chart-card">
      <h3>{h}</h3>
      <p className="cap">{cap}</p>
      <LineChart
        points={data}
        color={color}
        band={band}
        bandColor={bandColor}
        bands={bands}
      />
    </div>
  );
}
