import { FiMaximize2 } from "react-icons/fi";
import { GROW, type Zone, zoneOf, fmt } from "../zones";
import { ZoneBar } from "./ZoneBar";
import type { MetricKey } from "../metrics";

interface Props {
  name: string;
  desc: string;
  value: number | null | undefined;
  zones: Zone[];
  lo: number;
  hi: number;
  // when set, the gauge is clickable and opens the reference modal
  metricKey?: MetricKey;
  onExpand?: (key: MetricKey, rect: DOMRect) => void;
  isReliableValue?: (value: number) => boolean;
}

export function FormantGauge({
  name,
  desc,
  value,
  zones,
  lo,
  hi,
  metricKey,
  onExpand,
  isReliableValue,
}: Props) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const isOutlier = !!(hasValue && isReliableValue && !isReliableValue(value));
  const z = isOutlier ? null : zoneOf(zones, value);
  const clickable = !!(metricKey && onExpand);
  const open = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clickable) return;
    onExpand!(metricKey!, e.currentTarget.getBoundingClientRect());
  };
  return (
    <div
      className={`fgauge${clickable ? " is-clickable" : ""}`}
      onClick={open}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExpand!(metricKey!, e.currentTarget.getBoundingClientRect());
              }
            }
          : undefined
      }
      aria-label={clickable ? `Open ${name} resonance reference scale` : undefined}
      title={clickable ? "tap to see how you compare to real voices 🔍" : undefined}
    >
      <div className="fgauge-head">
        <span className="fname">
          <b>{name}</b> <span>{desc}</span>
        </span>
        <span className="fval">
          {fmt(value)} Hz{" "}
          {z && (
            <span className="pill" style={{ background: z.color, color: "#5a4566" }}>
              {z.name}
            </span>
          )}
          {isOutlier && (
            <span className="pill" style={{ background: GROW, color: "#5a4566" }}>
              outlier
            </span>
          )}
          {clickable && (
            <span className="fgauge-expand" aria-hidden="true">
              <FiMaximize2 />
            </span>
          )}
        </span>
      </div>
      <ZoneBar zones={zones} value={isOutlier ? null : value} lo={lo} hi={hi} />
      <div className="fends">
        <span>← deeper / larger tract</span>
        <span>brighter / smaller tract →</span>
      </div>
    </div>
  );
}
