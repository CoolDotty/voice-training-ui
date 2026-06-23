import type { RecordingDetail } from "../types";
import { MASC, FEM } from "../zones";

interface Props {
  detail: RecordingDetail;
  femThreshold?: number; // Hz that reads feminine (for the soft pink band)
}

// The pitch contour over time, with the register floor drawn across it.
// Frames that crash BELOW the floor are painted blue (the masculine register),
// so register breaks at phrase endings jump out visually. Phrase boundaries
// are marked with soft dividers and a dot under each ending (pink = landed in
// register, blue = fell out).
export function ContourChart({ detail, femThreshold = 165 }: Props) {
  const W = 900;
  const H = 240;
  const pad = { l: 40, r: 14, t: 14, b: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const floor = detail.register_floor_hz;
  const { t, hz } = detail.frames;
  const dur = detail.duration_s || t[t.length - 1] || 1;

  const voiced = hz.filter((v): v is number => v != null);
  const maxHz = Math.max(220, ...voiced, femThreshold) * 1.05;
  const minHz = Math.min(80, floor - 20, ...voiced);

  const x = (time: number) => pad.l + (time / dur) * iw;
  const y = (f: number) =>
    pad.t + (1 - (f - minHz) / (maxHz - minHz)) * ih;

  // Build contour segments, split into "in register" vs "crashed" runs so each
  // can be stroked its own color. A run breaks on unvoiced gaps too.
  type Seg = { below: boolean; pts: [number, number][] };
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  for (let i = 0; i < hz.length; i++) {
    const f = hz[i];
    if (f == null) {
      cur = null;
      continue;
    }
    const below = f < floor;
    if (!cur || cur.below !== below) {
      cur = { below, pts: [] };
      segs.push(cur);
    }
    cur.pts.push([x(t[i]), y(f)]);
  }
  const toPath = (pts: [number, number][]) =>
    pts.map((p, k) => `${k ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const yTicks = [minHz, floor, femThreshold, maxHz].filter(
    (v, i, a) => a.indexOf(v) === i && v <= maxHz && v >= minHz,
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="contour">
      {/* feminine band (soft pink, above the fem threshold) */}
      <rect
        x={pad.l}
        y={y(maxHz)}
        width={iw}
        height={y(femThreshold) - y(maxHz)}
        fill={FEM}
        opacity={0.12}
      />
      {/* sub-register band (blue, below the floor) */}
      <rect
        x={pad.l}
        y={y(floor)}
        width={iw}
        height={y(minHz) - y(floor)}
        fill={MASC}
        opacity={0.22}
      />

      {/* register floor line */}
      <line
        x1={pad.l}
        x2={W - pad.r}
        y1={y(floor)}
        y2={y(floor)}
        stroke="#7c9fd6"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <text x={W - pad.r} y={y(floor) - 5} fontSize="10" fill="#5e7fb8" textAnchor="end">
        register floor {floor} Hz
      </text>

      {/* phrase dividers */}
      {detail.phrases.map((p, k) => (
        <line
          key={`d${k}`}
          x1={x(p.end)}
          x2={x(p.end)}
          y1={pad.t}
          y2={pad.t + ih}
          stroke="#e7ddef"
          strokeWidth={1}
        />
      ))}

      {/* y ticks */}
      {yTicks.map((v, k) => (
        <text key={`y${k}`} x={pad.l - 6} y={y(v) + 3} fontSize="9" fill="#9d8ba8" textAnchor="end">
          {Math.round(v)}
        </text>
      ))}

      {/* the contour */}
      {segs.map((s, k) => (
        <path
          key={`s${k}`}
          d={toPath(s.pts)}
          fill="none"
          stroke={s.below ? "#5e7fb8" : "#e07ab0"}
          strokeWidth={s.below ? 3 : 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={s.below ? 1 : 0.9}
        />
      ))}

      {/* per-phrase landing dots (under each phrase ending) */}
      {detail.phrases.map((p, k) => (
        <circle
          key={`l${k}`}
          cx={x(p.end)}
          cy={pad.t + ih + 14}
          r={4.5}
          fill={p.ended_in_register ? FEM : MASC}
          stroke="#fff"
          strokeWidth={1.5}
        >
          <title>
            phrase {k + 1}: ended {p.offset_hz} Hz —{" "}
            {p.ended_in_register ? "landed in register 💕" : "fell out of register"}
          </title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6} fontSize="10" fill="#9d8ba8">
        time →
      </text>
      <text x={W - pad.r} y={H - 6} fontSize="10" fill="#9d8ba8" textAnchor="end">
        ● dots = how each phrase landed
      </text>
    </svg>
  );
}
