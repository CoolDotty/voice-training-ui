// Design-system entry: re-exports the Voice Garden component library for
// claude.ai/design (consumed by /design-sync). Not used by the app itself —
// the app mounts via main.tsx. Keep this in sync with src/components/ and
// src/annotations/lib/.
export { StatCard } from "./components/StatCard";
export { ResonanceCard } from "./components/ResonanceCard";
export { ZoneBar } from "./components/ZoneBar";
export { RecordingCard } from "./components/RecordingCard";
export { CheatSheet } from "./components/CheatSheet";
export { LineChart } from "./components/LineChart";
export { FormantGauge } from "./components/FormantGauge";
export { ContourChart } from "./components/ContourChart";
export { RegisterSection } from "./components/RegisterSection";

// Reusable annotation/insight building blocks.
export { InsightCard } from "./annotations/lib/InsightCard";
export { Drill } from "./annotations/lib/Drill";
export { PhraseEndingStrip } from "./annotations/lib/PhraseEndingStrip";

// Context provider that register/annotation-aware components read from
// (exported so previews can wrap components that call useAnnotations / <Note>).
export { AnnotationsProvider } from "./annotations/AnnotationsProvider";
