import { useCallback, useEffect, useMemo, useState } from "react";
import WavesurferPlayer from "@wavesurfer/react";
import type WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import { getAudioBlob } from "../services/recordingStore";

// Themed waveform player (wavesurfer.js) — replaces the native <audio> bar so
// playback matches the pastel theme AND shows the take's actual voice shape.
// Colors come from the index.css palette; pink = played, lavender = ahead.

// ---------------------------------------------------------------------------
// Exclusive-playback coordinator — module singleton
// Only one WaveSurfer instance may play at a time. When a player starts, it
// registers itself here; any previously-registered instance is paused first.
// Calling .pause() on the old instance fires its own onPause handler, which
// flips its button back to "play" automatically — no extra wiring needed.
// ---------------------------------------------------------------------------
const audioBus = {
  current: null as WaveSurfer | null,

  /** Call when a player begins playing. Pauses any other active player. */
  activate(ws: WaveSurfer) {
    if (audioBus.current && audioBus.current !== ws) {
      audioBus.current.pause();
    }
    audioBus.current = ws;
  },

  /** Call when a player pauses or finishes. Clears the reference if it owns it. */
  deactivate(ws: WaveSurfer) {
    if (audioBus.current === ws) {
      audioBus.current = null;
    }
  },
};

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface PlayerProps {
  /** path relative to public/ (e.g. "audio/001.mp3"), or null to render nothing */
  src?: string | null;
  /** IndexedDB blob key for browser-created recordings */
  audioBlobId?: string | null;
  /** known duration in seconds (optional; wavesurfer reports the real one) */
  duration?: number | null;
  /** filename suggested when downloading */
  downloadName?: string;
  /** start playback as soon as the waveform is ready */
  autoPlay?: boolean;
}

export function WaveformPlayer({
  src,
  audioBlobId,
  duration,
  downloadName,
  autoPlay = false,
}: PlayerProps) {
  const [ws, setWs] = useState<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(duration ?? 0);
  const [vol, setVol] = useState(1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobType, setBlobType] = useState<string | null>(null);

  // hover-to-seek preview: a soft pink line + time tooltip following the cursor.
  // created once so it isn't re-instantiated on every render.
  const plugins = useMemo(
    () => [
      Hover.create({
        lineColor: "#ff89bb",
        lineWidth: 2,
        labelBackground: "#b06a96",
        labelColor: "#ffffff",
        labelSize: 11,
      }),
    ],
    [],
  );

  const onReady = useCallback(
    (w: WaveSurfer) => {
      setWs(w);
      setDur(w.getDuration() || duration || 0);
      w.setVolume(vol);
      setPlaying(false);
      if (autoPlay) {
        audioBus.activate(w);
        void w.play().catch(() => {
          audioBus.deactivate(w);
          setPlaying(false);
        });
      }
    },
    [autoPlay, duration, vol],
  );

  useEffect(() => {
    if (src || !audioBlobId) {
      setBlobUrl(null);
      setBlobType(null);
      return;
    }

    let alive = true;
    let objectUrl: string | null = null;
    getAudioBlob(audioBlobId)
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setBlobType(blob.type || null);
      })
      .catch(() => {
        if (alive) {
          setBlobUrl(null);
          setBlobType(null);
        }
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audioBlobId, src]);

  const url = src ? `${import.meta.env.BASE_URL}${src}` : blobUrl;
  if (!url) return null;
  const ext = src?.split(".").pop() || extensionForType(blobType) || "webm";

  return (
    <div className="player">
      <button
        className="play"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => ws?.playPause()}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="2.5" width="3.6" height="11" rx="1.4" fill="currentColor" />
            <rect x="9.4" y="2.5" width="3.6" height="11" rx="1.4" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2.8 L13 8 L4.5 13.2 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="wave">
        <WavesurferPlayer
          url={url}
          height={42}
          normalize
          waveColor="#bfa9e6"
          progressColor="#ff9ec5"
          cursorColor="#ff89bb"
          cursorWidth={2}
          barWidth={2.5}
          barGap={1.6}
          barRadius={3}
          plugins={plugins}
          onReady={onReady}
          onPlay={(w: WaveSurfer) => { audioBus.activate(w); setPlaying(true); }}
          onPause={(w: WaveSurfer) => { audioBus.deactivate(w); setPlaying(false); }}
          onFinish={(w: WaveSurfer) => { audioBus.deactivate(w); setPlaying(false); }}
          onTimeupdate={(_w: WaveSurfer, time: number) => setCur(time)}
        />
      </div>

      <div className="time">
        {fmtTime(cur)} <span>/ {fmtTime(dur)}</span>
      </div>

      <div className="vol">
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="#c0a9d6" />
          <path
            d="M16 8.5 C18 10 18 14 16 15.5"
            stroke="#c0a9d6"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={vol}
          aria-label="Volume"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            ws?.setVolume(v);
          }}
        />
      </div>

      <a
        className="dl"
        href={url}
        download={`${downloadName ?? "voice-sample"}.${ext}`}
        aria-label="Download this voice sample"
        title="Download this voice sample"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 V14 M8 10 L12 14 L16 10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 17 V18.5 A1.5 1.5 0 0 0 6.5 20 H17.5 A1.5 1.5 0 0 0 19 18.5 V17"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </a>
    </div>
  );
}

function extensionForType(type: string | null): string | null {
  if (!type) return null;
  if (type.includes("mp4")) return "m4a";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("webm")) return "webm";
  return null;
}
