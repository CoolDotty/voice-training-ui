import type { ReactNode } from "react";
import { FEM, GROW } from "../../zones";

// A tiny "this take vs. another take" comparison strip. One row per metric, with
// the two values side by side and a soft arrow showing which way it moved. Use
// when a take is best understood as a *trend* against a previous recording.
//
// `better` says which direction is the good one for that metric ("up" or "down"),
// so the highlight is gentle and honest. Color is intentionally NON-gendered
// (pink = the nicer value, GROW = room to grow) — this compares *her own takes*,
// not masc/fem, so blue is never used here.
export interface CompareRow {
  label: string;
  /** value for THIS take */
  a: number | null;
  /** value for the OTHER take */
  b: number | null;
  unit?: string;
  /** which direction is the desirable one */
  better?: "up" | "down";
  /** override the label for the "other" column (defaults to "other take") */
}

export function StatCompare({
  rows,
  aTitle = "this take",
  bTitle = "other take",
}: {
  rows: CompareRow[];
  aTitle?: ReactNode;
  bTitle?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr auto auto auto",
        gap: "2px 14px",
        alignItems: "center",
        margin: "12px 0 4px",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--ink-soft)", fontSize: 11.5 }} />
      <div style={{ fontWeight: 700, textAlign: "right", fontSize: 11.5 }}>{aTitle}</div>
      <div style={{ width: 18 }} />
      <div
        style={{
          fontWeight: 600,
          textAlign: "right",
          fontSize: 11.5,
          color: "var(--ink-soft)",
        }}
      >
        {bTitle}
      </div>

      {rows.map((r, i) => {
        const hasBoth = r.a !== null && r.b !== null;
        // Did THIS take move in the desirable direction vs the other take?
        let aIsBetter: boolean | null = null;
        if (hasBoth && r.better) {
          aIsBetter = r.better === "up" ? (r.a as number) > (r.b as number) : (r.a as number) < (r.b as number);
        }
        const arrow = !hasBoth || r.a === r.b ? "·" : (r.a as number) > (r.b as number) ? "↑" : "↓";
        const hi = aIsBetter === null ? "var(--ink)" : aIsBetter ? FEM : GROW;
        return (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ color: "var(--ink-soft)", paddingTop: 3 }}>{r.label}</div>
            <div
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: aIsBetter === false ? "var(--ink)" : aIsBetter ? "#c75c93" : "var(--ink)",
                paddingTop: 3,
              }}
            >
              {r.a === null ? "—" : r.a}
              {r.unit ?? ""}
            </div>
            <div
              style={{
                textAlign: "center",
                color: hi,
                fontWeight: 700,
                paddingTop: 3,
              }}
              aria-hidden
            >
              {arrow}
            </div>
            <div
              style={{
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink-soft)",
                paddingTop: 3,
              }}
            >
              {r.b === null ? "—" : r.b}
              {r.unit ?? ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
