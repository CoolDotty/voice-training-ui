import { FEM, GROW, MASC } from "../../zones";

// MelodyArc — a tiny sparkline of how melody has moved across takes. Once there
// are several recordings, the single most important story ("is the TUNE getting
// livelier?") is a trend, not a single number — so this plots it over time.
//
// Two series per take:
//   • TRUE in-register melody (solid pink line + dots) — the honest tune.
//   • RAW semitone SD (faint dashed grey) — inflated by register crashes.
// The GAP between them is the "mirage": when raw rises but true stays flat, the
// extra "variation" is crashes diving out of register, not real melody. An
// optional dashed target line marks the lively goal (e.g. her best take's melody).
//
// Color note: this is a non-gendered SKILL trend (flat → lively), so pink = the
// honest melody we want up, grey = the raw/mirage line. Blue (MASC) is used ONLY
// for the small "← mirage / crashes" gap label, because that gap literally is
// pitch falling toward masculine register. That's the sanctioned meaning of blue.
export interface MelodyPoint {
  /** take id / label for the x-axis tick (e.g. "1".."5") */
  label: string;
  /** true in-register semitone SD — the honest melody */
  trueSt: number | null;
  /** raw semitone SD — inflated by crashes (optional) */
  rawSt?: number | null;
  /** highlight this point (the current take) */
  current?: boolean;
}

export function MelodyArc({
  points,
  target,
  targetLabel = "lively",
}: {
  points: MelodyPoint[];
  /** optional dashed goal line, in semitones */
  target?: number;
  targetLabel?: string;
}) {
  const W = 900;
  const H = 220;
  const pad = { l: 40, r: 16, t: 18, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const vals = points.flatMap((p) => [p.trueSt, p.rawSt].filter((v): v is number => v != null));
  const maxSt = Math.max(target ?? 0, ...vals, 5) * 1.08;
  const minSt = 0;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (s: number) => pad.t + (1 - (s - minSt) / (maxSt - minSt)) * ih;

  const truePts = points.map((p, i) => (p.trueSt == null ? null : [x(i), y(p.trueSt)] as const));
  const rawPts = points.map((p, i) => (p.rawSt == null ? null : [x(i), y(p.rawSt)] as const));
  const toPath = (pts: (readonly [number, number] | null)[]) =>
    pts.filter((p): p is readonly [number, number] => p != null)
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(" ");

  // gridlines at whole semitones
  const ticks: number[] = [];
  for (let s = 0; s <= maxSt; s += 1) ticks.push(s);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ marginTop: 12 }} role="img"
      aria-label="Melody (in-register semitone variation) across takes">
      {/* y gridlines */}
      {ticks.map((s) => (
        <g key={s}>
          <line x1={pad.l} x2={W - pad.r} y1={y(s)} y2={y(s)} stroke="#efe6f0" strokeWidth={1} />
          <text x={pad.l - 6} y={y(s) + 3} fontSize="10" fill="#b7a8c2" textAnchor="end">{s}</text>
        </g>
      ))}
      <text x={pad.l - 6} y={pad.t - 6} fontSize="9.5" fill="#b7a8c2" textAnchor="end">st</text>

      {/* target / goal line */}
      {target != null && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke={FEM}
            strokeWidth={1.5} strokeDasharray="6 5" opacity={0.9} />
          <text x={W - pad.r} y={y(target) - 5} fontSize="10.5" fill="#c75c93" textAnchor="end" fontWeight={700}>
            {targetLabel} {target} st
          </text>
        </g>
      )}

      {/* mirage gap shading (raw above true) on the current point */}
      {points.map((p, i) => {
        if (!p.current || p.rawSt == null || p.trueSt == null) return null;
        const yt = y(p.trueSt);
        const yr = y(p.rawSt);
        if (yr >= yt) return null;
        return (
          <g key={`gap${i}`}>
            <line x1={x(i)} x2={x(i)} y1={yr} y2={yt} stroke={MASC} strokeWidth={9} opacity={0.4} strokeLinecap="round" />
            <text x={x(i) - 12} y={(yr + yt) / 2 + 3} fontSize="10" fill="#5e7fb8" textAnchor="end">
              mirage
            </text>
          </g>
        );
      })}

      {/* raw (mirage) line — faint dashed grey */}
      <path d={toPath(rawPts)} fill="none" stroke={GROW} strokeWidth={2} strokeDasharray="4 4" opacity={0.85} />
      {rawPts.map((p, i) => p && (
        <circle key={`r${i}`} cx={p[0]} cy={p[1]} r={3} fill={GROW} stroke="#fff" strokeWidth={1}>
          <title>take {points[i].label}: raw swing {points[i].rawSt} st (inflated by crashes)</title>
        </circle>
      ))}

      {/* true melody line — solid pink */}
      <path d={toPath(truePts)} fill="none" stroke={FEM} strokeWidth={3} />
      {truePts.map((p, i) => p && (
        <circle key={`t${i}`} cx={p[0]} cy={p[1]} r={points[i].current ? 7 : 5}
          fill={FEM} stroke={points[i].current ? "#c75c93" : "#fff"} strokeWidth={points[i].current ? 2.5 : 1.5}>
          <title>take {points[i].label}: true melody {points[i].trueSt} st{points[i].current ? " (this take)" : ""}</title>
        </circle>
      ))}

      {/* x labels */}
      {points.map((p, i) => (
        <text key={`x${i}`} x={x(i)} y={H - 14} fontSize="11" textAnchor="middle"
          fill={p.current ? "#c75c93" : "#9d8ba8"} fontWeight={p.current ? 700 : 400}>
          #{p.label}
        </text>
      ))}
      <text x={pad.l} y={H - 2} fontSize="10" fill="#9d8ba8">
        pink = true in-register melody · grey dashed = raw swing (inflated by crashes)
      </text>
    </svg>
  );
}
