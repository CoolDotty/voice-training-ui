export interface Point {
  label: number;
  y: number | null | undefined;
}

// A shaded horizontal zone band (e.g. light/medium/heavy on the weight chart).
export interface ChartBand {
  from: number;
  to: number;
  color: string;
}

interface Props {
  points: Point[];
  color?: string;
  band?: [number, number];
  bandColor?: string;
  bands?: ChartBand[]; // multi-zone background (matches the stat-card zone colors)
}

// tiny SVG line chart — faithful port of the vanilla dashboard's lineChart(),
// plus optional multi-zone shaded backgrounds.
export function LineChart({ points, color = "#b06a96", band, bandColor, bands }: Props) {
  const W = 300;
  const H = 130;
  const pad = { l: 34, r: 12, t: 12, b: 24 };
  const vals = points
    .map((p) => p.y)
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return <div className="cap">no data yet</div>;

  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (band) {
    min = Math.min(min, band[0]);
    max = Math.max(max, band[1]);
  }
  if (bands && bands.length) {
    for (const b of bands) {
      min = Math.min(min, b.from);
      max = Math.max(max, b.to);
    }
  }
  const range = max - min || 1;
  // Pad the axis only when there are no explicit zone bands; with bands we want
  // the plot to fill the zone extent so the colored regions read cleanly.
  if (!bands || !bands.length) {
    min -= range * 0.15;
    max += range * 0.15;
  }
  const n = points.length;
  const x = (i: number) =>
    pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  const valid = points
    .map((p, i) => ({ i, ...p }))
    .filter((p): p is { i: number; label: number; y: number } => p.y !== null && p.y !== undefined);
  const path = valid
    .map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.y).toFixed(1)}`)
    .join(" ");
  const yTicks = [min, (min + max) / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {bands?.map((b, k) => (
        <rect
          key={`band${k}`}
          x={pad.l}
          y={y(b.to)}
          width={W - pad.l - pad.r}
          height={y(b.from) - y(b.to)}
          fill={b.color}
          opacity="0.16"
        />
      ))}
      {band && (
        <rect
          x={pad.l}
          y={y(band[1])}
          width={W - pad.l - pad.r}
          height={y(band[0]) - y(band[1])}
          fill={bandColor || "#ffb6d5"}
          opacity="0.22"
          rx="4"
        />
      )}
      {yTicks.map((v, k) => (
        <text
          key={k}
          x={pad.l - 6}
          y={(y(v) + 3).toFixed(1)}
          fontSize="9"
          fill="#9d8ba8"
          textAnchor="end"
        >
          {Math.round(v)}
        </text>
      ))}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {valid.map((p, k) => (
        <circle
          key={k}
          cx={x(p.i).toFixed(1)}
          cy={y(p.y).toFixed(1)}
          r="4"
          fill="#fff"
          stroke={color}
          strokeWidth="2.5"
        >
          <title>
            #{p.label}: {p.y}
          </title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text
          key={i}
          x={x(i).toFixed(1)}
          y={H - 7}
          fontSize="9"
          fill="#9d8ba8"
          textAnchor="middle"
        >
          #{p.label}
        </text>
      ))}
    </svg>
  );
}
