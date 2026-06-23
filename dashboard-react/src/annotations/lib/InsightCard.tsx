import type { ReactNode } from "react";
import { RichText } from "../../components/RichText";

// Standard shell for an authored insight/callout: title, optional subtitle,
// optional stat badges, then the body. Reuse for consistency with the dashboard.
// All prose runs through <RichText>, so emoji authored anywhere in an insight
// render as custom icons — authors just type the emoji.
export function InsightCard({
  title,
  subtitle,
  badges,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: string[];
  children: ReactNode;
}) {
  return (
    <div className="insight">
      <h3>
        <RichText>{title}</RichText>
      </h3>
      {subtitle && (
        <p className="insight-sub">
          <RichText>{subtitle}</RichText>
        </p>
      )}
      {badges && badges.length > 0 && (
        <div className="insight-badges">
          {badges.map((b, i) => (
            <span className="insight-badge" key={i}>
              <RichText>{b}</RichText>
            </span>
          ))}
        </div>
      )}
      <RichText>{children}</RichText>
    </div>
  );
}
