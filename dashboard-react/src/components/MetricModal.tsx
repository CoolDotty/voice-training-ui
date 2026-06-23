import { useEffect, useMemo, useRef, useState } from "react";
import { FiVolume2 } from "react-icons/fi";
import type { Recording, ReferenceVoice } from "../types";
import type { MetricDef } from "../metrics";
import { MASC, FEM, fmt } from "../zones";
import { WaveformPlayer } from "./WaveformPlayer";

interface Props {
  metric: MetricDef;
  recordings: Recording[];
  references: ReferenceVoice[];
  activeId: number | null;
  // bounding rect of the card that was clicked, for the open animation origin
  origin: DOMRect | null;
  onClose: () => void;
}

interface Tick {
  v: number;
  pct: number; // true position on the scale (%) — never moves
  label: string;
  kind: "take" | "fem" | "masc";
  active: boolean;
  lane: number; // vertical row for stacked take/ref markers
  key: string; // unique id for playback selection
  audio?: string; // playable clip path, if any
  playTitle: string; // label shown above the player when this clip plays
  downloadName: string;
}

// what's currently selected for playback in the modal
interface Selected {
  key: string;
  audio: string;
  title: string;
  downloadName: string;
}

const clampPct = (p: number) => Math.min(100, Math.max(0, p));

// vertical spacing for stacked take markers (px)
const TAKE_ROW = 22; // height of one stack lane
// gap between the LOWEST dot (lane 0) and the bar, so EVERY dot floats above the
// bar with a visible guide line — never sitting flush on it.
const TAKE_GAP = 6;
const DOT_R = 8; // ~dot radius, so the guide reaches the bar top

// Assign each tick a "lane" (0,1,2,…) so ticks whose positions are within
// `minGap` % of each other get stacked vertically instead of colliding.
// Greedy: sort by pct, drop each tick into the lowest lane whose last tick is
// far enough to the left.
function assignLanes(ticks: Tick[], minGap: number): number {
  const ordered = [...ticks].sort((a, b) => a.pct - b.pct);
  const laneRight: number[] = []; // right-edge pct of the last tick in each lane
  let maxLane = 0;
  for (const t of ordered) {
    let lane = laneRight.findIndex((r) => t.pct - r >= minGap);
    if (lane === -1) {
      lane = laneRight.length;
      laneRight.push(t.pct);
    } else {
      laneRight[lane] = t.pct;
    }
    t.lane = lane;
    if (lane > maxLane) maxLane = lane;
  }
  return maxLane;
}

export function MetricModal({
  metric,
  recordings,
  references,
  activeId,
  origin,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // which clip (take or reference) is loaded into the in-modal player
  const [selected, setSelected] = useState<Selected | null>(null);

  const play = (t: Tick) => {
    if (!t.audio) return;
    setSelected((cur) =>
      cur?.key === t.key
        ? null // click the same one again → close the player
        : {
            key: t.key,
            audio: t.audio!,
            title: t.playTitle,
            downloadName: t.downloadName,
          },
    );
  };

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scale: stretch the metric's lo/hi so every real value (takes + refs) fits.
  const { lo, hi } = useMemo(() => {
    let lo = metric.lo;
    let hi = metric.hi;
    const vals: number[] = [];
    for (const r of recordings) {
      const v = metric.take(r);
      if (v != null && isFinite(v)) vals.push(v);
    }
    if (metric.showRefs) {
      for (const ref of references) {
        const v = metric.ref(ref);
        if (v != null && isFinite(v)) vals.push(v);
      }
    }
    for (const v of vals) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const pad = (hi - lo) * 0.06 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [metric, recordings, references]);

  const span = hi - lo || 1;
  const toPct = (v: number) => clampPct(((v - lo) / span) * 100);

  const takeTicks: Tick[] = recordings
    .map((r) => {
      const v = metric.take(r);
      if (v == null || !isFinite(v)) return null;
      return {
        v,
        pct: toPct(v),
        label: `#${r.id}`,
        kind: "take" as const,
        active: r.id === activeId,
        lane: 0,
        key: `take-${r.id}`,
        audio: r.audio ?? undefined,
        playTitle: `take #${r.id} — ${r.label}`,
        downloadName: `voice-take-${r.id}`,
      };
    })
    .filter(Boolean) as Tick[];

  const refTicks: Tick[] = metric.showRefs
    ? (references
        .map((ref, idx) => {
          const v = metric.ref(ref);
          if (v == null || !isFinite(v)) return null;
          return {
            v,
            pct: toPct(v),
            label: ref.label,
            kind: ref.gender === "f" ? ("fem" as const) : ("masc" as const),
            active: false,
            lane: 0,
            key: `ref-${idx}`,
            audio: ref.audio,
            playTitle: ref.label,
            downloadName: ref.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
          };
        })
        .filter(Boolean) as Tick[])
    : [];

  // Each take = a dot + label pair sitting at the take's TRUE horizontal value.
  // When two are too close, the later one is bumped UP a lane (vertical offset)
  // so dot+label never overlap. A thin dashed guide drops from each dot down to
  // the bar so you can always read off its true position.
  const takeLanes = assignLanes(takeTicks, 16) + 1; // dot+label width as % gap

  // animation origin → CSS custom props so the card grows out of the clicked card
  const style = origin
    ? ({
        "--ox": `${origin.left + origin.width / 2}px`,
        "--oy": `${origin.top + origin.height / 2}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="mm-backdrop" onClick={onClose} style={style}>
      <div
        className="mm-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${metric.title} reference scale`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="mm-close" onClick={onClose} aria-label="close">
          ✕
        </button>

        <div className="mm-head">
          <h3>{metric.title} reference scale</h3>
          <p>{metric.blurb}</p>
        </div>

        <div className="mm-scale-wrap">
          {/* her takes ABOVE the band: each is a dot+label pair at its true
              horizontal value, bumped up into lanes when too close, with a thin
              dashed guide dropping straight down to the bar. */}
          <div
            className="mm-takes"
            style={{ height: TAKE_GAP + DOT_R + takeLanes * TAKE_ROW }}
          >
            {takeTicks.map((t, i) => (
              <div
                key={`t${i}`}
                className={`mm-take${t.active ? " is-active" : ""}${
                  t.audio ? " is-clickable" : ""
                }${selected?.key === t.key ? " is-playing" : ""}`}
                style={{
                  left: `${t.pct}%`,
                  bottom: TAKE_GAP + t.lane * TAKE_ROW,
                }}
                onClick={t.audio ? () => play(t) : undefined}
                role={t.audio ? "button" : undefined}
                tabIndex={t.audio ? 0 : undefined}
                onKeyDown={
                  t.audio
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          play(t);
                        }
                      }
                    : undefined
                }
                aria-label={
                  t.audio
                    ? `Play take ${t.label}${
                        selected?.key === t.key ? " (now playing)" : ""
                      }`
                    : undefined
                }
                title={`take ${t.label} · ${fmt(
                  Math.round(t.v * 10) / 10,
                )}${metric.unit}${t.audio ? " · 🔊 click to hear it" : ""}`}
              >
                {/* dashed guide from this dot straight down to the bar */}
                <span
                  className="mm-guide"
                  style={{ height: TAKE_GAP + t.lane * TAKE_ROW + DOT_R }}
                />
                <span className="mm-take-dot">
                  {t.audio && (
                    <FiVolume2 className="mm-spk" aria-hidden="true" />
                  )}
                </span>
                <span className="mm-take-label">{t.label}</span>
              </div>
            ))}
          </div>

          {/* colored zone band reusing the metric's zone colors */}
          <div className="mm-band">
            {metric.zones.map((z, i) => {
              const left = clampPct(((z.from - lo) / span) * 100);
              const right = clampPct(((z.to - lo) / span) * 100);
              return (
                <div
                  key={i}
                  className="mm-seg"
                  style={{
                    left: `${left}%`,
                    width: `${right - left}%`,
                    background: z.color,
                  }}
                >
                  <span className="mm-seg-name">{z.name}</span>
                </div>
              );
            })}
          </div>

          {/* reference voices: smaller pink/blue ticks below the band, all at a
              uniform height (a light backdrop showing where real voices sit) */}
          {refTicks.length > 0 && (
            <div className="mm-row mm-row-ref">
              {refTicks.map((t, i) => (
                <div
                  key={`r${i}`}
                  className={`mm-ref mm-ref-${t.kind}${
                    t.audio ? " is-clickable" : ""
                  }${selected?.key === t.key ? " is-playing" : ""}`}
                  style={{ left: `${t.pct}%` }}
                  onClick={t.audio ? () => play(t) : undefined}
                  role={t.audio ? "button" : undefined}
                  tabIndex={t.audio ? 0 : undefined}
                  onKeyDown={
                    t.audio
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            play(t);
                          }
                        }
                      : undefined
                  }
                  aria-label={
                    t.audio
                      ? `Play reference voice ${t.label}${
                          selected?.key === t.key ? " (now playing)" : ""
                        }`
                      : undefined
                  }
                  title={`${t.label} · ${fmt(Math.round(t.v))}${metric.unit}${
                    t.audio ? " · 🔊 click to hear it" : ""
                  }`}
                >
                  <span className="mm-ref-stem" />
                  {t.audio && (
                    <FiVolume2 className="mm-ref-spk" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mm-axis">
            <span>
              {Math.round(lo)}
              {metric.unit}
            </span>
            <span>
              {Math.round(hi)}
              {metric.unit}
            </span>
          </div>
        </div>

        {/* in-modal player: appears below the scale when a dot / ref tick with a
            clip is clicked */}
        {selected && (
          <div className="mm-player">
            <div className="mm-player-head">
              <span className="mm-player-title">🎧 {selected.title}</span>
              <button
                className="mm-player-close"
                onClick={() => setSelected(null)}
                aria-label="close player"
              >
                ✕
              </button>
            </div>
            <WaveformPlayer
              key={selected.key}
              src={selected.audio}
              downloadName={selected.downloadName}
            />
          </div>
        )}

        <div className="mm-hear">
          <FiVolume2 className="mm-hear-icon" aria-hidden="true" />
          <span>
            click any <b>dot</b> or <b>tick</b> to hear that voice
          </span>
        </div>

        <div className="mm-legend">
          <span>
            <i className="mm-key mm-key-take" /> your takes
          </span>
          {metric.showRefs ? (
            <>
              <span>
                <i className="mm-key mm-key-fem" style={{ background: FEM }} />{" "}
                women's voices
              </span>
              <span>
                <i className="mm-key mm-key-masc" style={{ background: MASC }} />{" "}
                men's voices
              </span>
            </>
          ) : (
            <span className="mm-legend-note">
              reference voices shown on gendered metrics (Pitch, Weight)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
