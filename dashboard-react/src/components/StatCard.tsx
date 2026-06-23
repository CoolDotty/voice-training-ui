import type { ReactNode } from "react";
import { FiMaximize2 } from "react-icons/fi";
import { type Zone, zoneOf, fmt } from "../zones";
import { ZoneBar } from "./ZoneBar";
import type { MetricKey } from "../metrics";

interface Props {
  title: string;
  value: number | null | undefined;
  unit?: string;
  zones?: Zone[];
  lo?: number;
  hi?: number;
  sub?: ReactNode;
  // when set (only on bar cards), the card is clickable and opens the
  // reference modal for this metric.
  metricKey?: MetricKey;
  onExpand?: (key: MetricKey, rect: DOMRect) => void;
}

export function StatCard({
  title,
  value,
  unit = "",
  zones,
  lo,
  hi,
  sub,
  metricKey,
  onExpand,
}: Props) {
  const z = zones ? zoneOf(zones, value) : null;
  const clickable = !!(metricKey && onExpand);
  const open = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clickable) return;
    onExpand!(metricKey!, e.currentTarget.getBoundingClientRect());
  };
  return (
    <div
      className={`stat${clickable ? " is-clickable" : ""}`}
      onClick={open}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExpand!(
                  metricKey!,
                  e.currentTarget.getBoundingClientRect(),
                );
              }
            }
          : undefined
      }
      aria-label={
        clickable ? `Open ${title} reference scale` : undefined
      }
      title={clickable ? "tap to see how you compare to real voices 🔍" : undefined}
    >
      {clickable && (
        <span className="stat-expand" aria-hidden="true">
          <FiMaximize2 />
        </span>
      )}
      <div className="label">
        <span>{title}</span>
        {z && (
          <span className="pill" style={{ background: z.color, color: "#5a4566" }}>
            {z.name}
          </span>
        )}
      </div>
      <div className="value">
        {fmt(value)}
        <small> {unit}</small>
      </div>
      {zones && lo !== undefined && hi !== undefined && (
        <ZoneBar zones={zones} value={value} lo={lo} hi={hi} />
      )}
      <div className="sub">{sub}</div>
      {clickable && <span className="stat-tap">tap to compare</span>}
    </div>
  );
}
