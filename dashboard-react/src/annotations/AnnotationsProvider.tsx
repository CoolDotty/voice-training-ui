import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Recording, RecordingDetail } from "../types";
import type { RecordingAnnotations } from "./types";

// Auto-discovery: one file per recording at entries/<NNN>.tsx (zero-padded id),
// default-exporting a RecordingAnnotations. Vite resolves this glob and HMR
// hot-loads new files during `npm run dev` — no registry edits.
// `import.meta.glob` is Vite-only (statically transformed at build time); the
// try/catch keeps the literal call site for Vite while letting non-Vite
// bundlers (e.g. the design-system export bundle) fall back to no entries
// instead of crashing at module load.
let entries: Record<string, () => Promise<unknown>> = {};
try {
  entries = import.meta.glob("./entries/*.tsx");
} catch {
  entries = {};
}

interface Ctx {
  recording: Recording;
  detail: RecordingDetail | null;
  ann: RecordingAnnotations | null;
}
const AnnCtx = createContext<Ctx | null>(null);

export function useAnnotations(): Ctx {
  const c = useContext(AnnCtx);
  if (!c)
    throw new Error("useAnnotations must be used within <AnnotationsProvider>");
  return c;
}

// Loads the active recording's heavy detail JSON + its annotations module once,
// and shares both via context so every section/slot reads from one place.
export function AnnotationsProvider({
  recording,
  children,
  initialDetail = null,
  initialAnn = null,
}: {
  recording: Recording;
  children: ReactNode;
  // Optional pre-loaded data — lets callers (e.g. tests or static previews)
  // inject the detail/annotations synchronously instead of fetching. When
  // omitted, behavior is unchanged: the provider fetches as before.
  initialDetail?: RecordingDetail | null;
  initialAnn?: RecordingAnnotations | null;
}) {
  const [detail, setDetail] = useState<RecordingDetail | null>(initialDetail);
  const [ann, setAnn] = useState<RecordingAnnotations | null>(initialAnn);

  useEffect(() => {
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
  }, [recording.detail, initialDetail]);

  useEffect(() => {
    const key = `./entries/${String(recording.id).padStart(3, "0")}.tsx`;
    const loader = entries[key];
    // No entry module: fall back to the injected annotations (null in the
    // app — clears any stale annotations; non-null only when pre-loaded).
    if (!loader) {
      setAnn(initialAnn);
      return;
    }
    setAnn(null);
    let alive = true;
    loader().then((m) => {
      const mod = m as { default: RecordingAnnotations };
      if (alive) setAnn(mod.default);
    });
    return () => {
      alive = false;
    };
  }, [recording.id, initialAnn]);

  return (
    <AnnCtx.Provider value={{ recording, detail, ann }}>
      {children}
    </AnnCtx.Provider>
  );
}

// Override slot: renders the agent's content for `id` if the active recording
// supplies it, else the shared default (children). For woven-in notes that
// always have a sensible generic version.
export function Note({ id, children }: { id: string; children?: ReactNode }) {
  const { ann, recording, detail } = useAnnotations();
  const fn = ann?.slots?.[id];
  return <>{fn ? fn({ recording, detail }) : children}</>;
}

// Insertion slot: renders the agent's content for `id` if present, else `empty`
// (nothing by default). For freeform cards/callouts the agent can drop anywhere.
export function Region({ id, empty = null }: { id: string; empty?: ReactNode }) {
  const { ann, recording, detail } = useAnnotations();
  const fn = ann?.slots?.[id];
  return <>{fn ? fn({ recording, detail }) : empty}</>;
}
