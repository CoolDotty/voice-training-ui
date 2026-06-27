import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Recording, RecordingDetail } from "../types";
import type { Insight } from "../types";
import { getInsight, getRecordingDetail } from "../services/recordingStore";
import { Drill, InsightCard } from "./lib";

interface Ctx {
  recording: Recording;
  detail: RecordingDetail | null;
  insight: Insight | null;
}
const AnnCtx = createContext<Ctx | null>(null);

export function useAnnotations(): Ctx {
  const c = useContext(AnnCtx);
  if (!c)
    throw new Error("useAnnotations must be used within <AnnotationsProvider>");
  return c;
}

export function AnnotationsProvider({
  recording,
  children,
  initialDetail = null,
}: {
  recording: Recording;
  children: ReactNode;
  initialDetail?: RecordingDetail | null;
}) {
  const [detail, setDetail] = useState<RecordingDetail | null>(initialDetail);
  const [insight, setInsight] = useState<Insight | null>(null);

  useEffect(() => {
    if (recording.detailId) {
      setDetail(null);
      let alive = true;
      getRecordingDetail(recording.detailId)
        .then((d) => alive && setDetail(d))
        .catch(() => alive && setDetail(null));
      return () => {
        alive = false;
      };
    }

    // No detail to fetch (or none configured): fall back to the injected
    // value (null in the app — clears any stale detail; non-null only when a
    // caller pre-loaded it, e.g. a static preview).
    if (!recording.detail) {
      setDetail(initialDetail);
      return;
    }
    setDetail(null);
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}${recording.detail}?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: RecordingDetail) => alive && setDetail(d))
      .catch(() => alive && setDetail(null));
    return () => {
      alive = false;
    };
  }, [recording.detail, recording.detailId, initialDetail]);

  useEffect(() => {
    if (!recording.detailId && !recording.audioBlobId && !recording.detail) {
      setInsight(null);
      return;
    }

    let alive = true;
    getInsight(recording.id)
      .then((i) => alive && setInsight(i))
      .catch(() => alive && setInsight(null));
    return () => {
      alive = false;
    };
  }, [recording.id, recording.detailId, recording.audioBlobId, recording.detail]);

  return (
    <AnnCtx.Provider value={{ recording, detail, insight }}>
      {children}
    </AnnCtx.Provider>
  );
}

export function Note({ children }: { id: string; children?: ReactNode }) {
  return <>{children}</>;
}

export function Region({ id, empty = null }: { id: string; empty?: ReactNode }) {
  const { insight } = useAnnotations();
  if (id === "region.insights" && insight) {
    return <RuleInsight insight={insight} />;
  }
  return <>{empty}</>;
}

function RuleInsight({ insight }: { insight: Insight }) {
  return (
    <InsightCard
      title={insight.headline}
      subtitle={insight.primaryIssue}
      badges={insight.badges}
    >
      <p>{insight.editedText || insight.summary}</p>
      <Drill title="Try this next">{insight.recommendedDrill}</Drill>
    </InsightCard>
  );
}
