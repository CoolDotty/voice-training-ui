import type { ReactNode } from "react";
import { RichText } from "../../components/RichText";

// A "try this" practice drill box. One per concrete, actionable thing to work on.
// Prose runs through <RichText> so authored emoji render as custom icons.
export function Drill({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="drill">
      <b>
        <RichText>🎯 {title}</RichText>
      </b>
      <div style={{ marginTop: 4 }}>
        <RichText>{children}</RichText>
      </div>
    </div>
  );
}
