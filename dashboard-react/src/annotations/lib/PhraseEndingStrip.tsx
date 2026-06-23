import type { RecordingDetail } from "../../types";
import { MASC, FEM } from "../../zones";

// Focused viz for "register at phrase boundaries": one dot per phrase ENDING,
// plotted at its offset pitch, with the register floor drawn across. Pink dot =
// landed in register; blue dot = trailed off below it.
export function PhraseEndingStrip({ detail }: { detail: RecordingDetail }) {
  const floor = detail.register_floor_hz;
  const phrases = detail.phrases;
  const W = 900;
  const H = 160;
  const pad = { l: 36, r: 14, t: 16, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const offs = phrases.map((p) => p.offset_hz);
  const maxHz = Math.max(220, ...offs) * 1.05;
  const minHz = Math.min(90, floor - 15, ...offs);
  const x = (i: number) =>
    pad.l + (phrases.length <= 1 ? iw / 2 : (i * iw) / (phrases.length - 1));
  const y = (f: number) => pad.t + (1 - (f - minHz) / (maxHz - minHz)) * ih;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ marginTop: 12 }}>
      <rect
        x={pad.l}
        y={y(floor)}
        width={iw}
        height={y(minHz) - y(floor)}
        fill={MASC}
        opacity={0.18}
      />
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
      {phrases.map((p, i) => (
        <g key={i}>
          <line
            x1={x(i)}
            x2={x(i)}
            y1={y(p.offset_hz)}
            y2={y(minHz)}
            stroke={p.ended_in_register ? FEM : MASC}
            strokeWidth={2}
            opacity={0.45}
          />
          <circle
            cx={x(i)}
            cy={y(p.offset_hz)}
            r={5}
            fill={p.ended_in_register ? FEM : MASC}
            stroke="#fff"
            strokeWidth={1.5}
          >
            <title>
              phrase {i + 1}: ended at {p.offset_hz} Hz —{" "}
              {p.ended_in_register ? "landed in register 💕" : "fell out"}
            </title>
          </circle>
        </g>
      ))}
      <text x={pad.l} y={H - 6} fontSize="10" fill="#9d8ba8">
        each dot = a phrase ending · blue = fell out of register
      </text>
    </svg>
  );
}
