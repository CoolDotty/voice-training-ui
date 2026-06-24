import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FaDice } from "react-icons/fa";
import type { Recording } from "../types";
import { createAnalysisWorkerClient } from "../services/analysisWorkerClient";
import { createRuleInsight } from "../services/insightRules";
import { getSetting, saveRecordingBundle, saveSetting } from "../services/recordingStore";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_LIBRARY,
  type ExerciseCategoryId,
  type PresetExerciseCategoryId,
} from "../data/exerciseLibrary";

const REGISTER_FLOOR_PRESETS = {
  beginner: 130,
  hard: 165,
} as const;
const EXERCISE_PICKER_SETTING_KEY = "exercisePicker";

type RegisterFloorMode = keyof typeof REGISTER_FLOOR_PRESETS | "custom";
type RecorderState = "idle" | "recording" | "ready" | "analyzing" | "saved" | "error";

interface ExercisePickerSetting {
  categoryId: ExerciseCategoryId;
  text: string;
  recentCategoryIds: ExerciseCategoryId[];
}

interface RecordingPanelProps {
  nextId: number;
  onSaved: (recording: Recording) => void;
}

interface StyledSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export function RecordingPanel({ nextId, onSaved }: RecordingPanelProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [label, setLabel] = useState(defaultLabel(nextId));
  const [exerciseCategoryId, setExerciseCategoryId] =
    useState<ExerciseCategoryId>("daily-check-in");
  const [exerciseText, setExerciseText] = useState(() =>
    pickExercise("daily-check-in"),
  );
  const [recentExerciseCategoryIds, setRecentExerciseCategoryIds] = useState<
    ExerciseCategoryId[]
  >([]);
  const [exerciseSettingsLoaded, setExerciseSettingsLoaded] = useState(false);
  const [registerFloorMode, setRegisterFloorMode] = useState<RegisterFloorMode>("beginner");
  const [registerFloor, setRegisterFloor] = useState(130);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const meterRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysisClientRef = useRef<ReturnType<typeof createAnalysisWorkerClient> | null>(null);
  const analysisCancelledRef = useRef(false);

  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    getSetting<number>("registerFloor").then((saved) => {
      if (typeof saved === "number" && Number.isFinite(saved)) {
        setRegisterFloor(saved);
        setRegisterFloorMode(modeForRegisterFloor(saved));
      }
    });
    getSetting<ExercisePickerSetting>(EXERCISE_PICKER_SETTING_KEY)
      .then((saved) => {
        if (!isExercisePickerSetting(saved)) return;
        setExerciseCategoryId(saved.categoryId);
        setExerciseText(
          saved.text.trim() ||
            (saved.categoryId === "custom" ? "" : pickExercise(saved.categoryId)),
        );
        setRecentExerciseCategoryIds(saved.recentCategoryIds.slice(0, 3));
      })
      .finally(() => setExerciseSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (!exerciseSettingsLoaded) return;
    void saveSetting<ExercisePickerSetting>(EXERCISE_PICKER_SETTING_KEY, {
      categoryId: exerciseCategoryId,
      text: exerciseText,
      recentCategoryIds: recentExerciseCategoryIds,
    });
  }, [
    exerciseCategoryId,
    exerciseSettingsLoaded,
    exerciseText,
    recentExerciseCategoryIds,
  ]);

  useEffect(() => {
    setLabel((current) =>
      current.trim() === "" || /^New Recording \(\d+\)$/.test(current)
        ? defaultLabel(nextId)
        : current,
    );
  }, [nextId]);

  useEffect(() => {
    return () => {
      stopMonitoring();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function startRecording() {
    setError(null);
    setDiagnostic(null);
    setBlob(null);
    setElapsed(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(recorded);
        setState("ready");
        stopMonitoring();
        stopStream();
      };
      recorder.start();
      setState("recording");
      startTimer();
      startMonitoring(stream);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    stopTimer();
  }

  function retake() {
    setBlob(null);
    setState("idle");
    setElapsed(0);
    setLevel(0);
    setError(null);
    setDiagnostic(null);
  }

  function addRecentExerciseCategory(categoryId: ExerciseCategoryId = exerciseCategoryId) {
    setRecentExerciseCategoryIds((current) => {
      const deduped = current.filter((item) => item !== categoryId);
      return [categoryId, ...deduped].slice(0, 3);
    });
  }

  function selectExerciseCategory(categoryId: ExerciseCategoryId) {
    setExerciseCategoryId(categoryId);
    if (categoryId === "custom") {
      setExerciseText("");
      return;
    }
    setExerciseText(pickExercise(categoryId, exerciseText));
  }

  function rerollExercise() {
    if (exerciseCategoryId === "custom") return;
    setExerciseText(pickExercise(exerciseCategoryId, exerciseText));
  }

  function restoreExerciseCategory(categoryId: ExerciseCategoryId) {
    setExerciseCategoryId(categoryId);
    if (categoryId === "custom") {
      setExerciseText("");
      return;
    }
    setExerciseText(pickExercise(categoryId, exerciseText));
  }

  async function saveTake() {
    if (!blob) return;
    setState("analyzing");
    setError(null);
    analysisCancelledRef.current = false;
    setDiagnostic("Decoding audio");

    const audioBlobId = `audio-${nextId}-${Date.now()}`;
    const detailId = `detail-${nextId}-${Date.now()}`;
    const date = new Date().toISOString().slice(0, 10);

    try {
      const decoded = await decodeToMono(blob);
      if (analysisCancelledRef.current) {
        throw new Error("Analysis cancelled");
      }
      setDiagnostic("Running Praat WASM");
      const client = createAnalysisWorkerClient();
      analysisClientRef.current = client;
      const exerciseNote = makeExerciseNote(exerciseCategoryId, exerciseText);
      const result = await client
        .analyze({
          samples: decoded.samples,
          sampleRate: decoded.sampleRate,
          label: label.trim() || defaultLabel(nextId),
          note: exerciseNote,
          registerFloor,
          id: nextId,
          date,
          sourceFile: "browser-recording",
        })
        .finally(() => {
          client.terminate();
          if (analysisClientRef.current === client) analysisClientRef.current = null;
        });

      const recording: Recording = {
        ...result.recording,
        id: nextId,
        label: label.trim() || defaultLabel(nextId),
        note: exerciseNote,
        date,
        source_file: "browser-recording",
        audio: null,
        audioBlobId,
        detail: undefined,
        detailId,
        isLocal: true,
      };
      const insight = createRuleInsight(recording, result.detail, result.diagnostics);
      await saveRecordingBundle({ recording, detail: result.detail, audioBlob: blob, insight });
      await saveSetting("registerFloor", registerFloor);
      addRecentExerciseCategory();
      setState("saved");
      setDiagnostic(`Saved with ${result.diagnostics.engine}`);
      onSaved(recording);
    } catch (err) {
      if (analysisCancelledRef.current) {
        setState("ready");
        setDiagnostic("Analysis cancelled");
        return;
      }
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelAnalysis() {
    analysisCancelledRef.current = true;
    analysisClientRef.current?.terminate();
  }

  function startTimer() {
    const started = Date.now();
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startMonitoring(stream: MediaStream) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const value of buffer) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
      meterRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  function stopMonitoring() {
    if (meterRef.current != null) window.cancelAnimationFrame(meterRef.current);
    meterRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setLevel(0);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  const busy = state === "recording" || state === "analyzing";

  return (
    <section className="record-panel" aria-label="Record a browser take">
      <div className="record-panel-head">
        <div>
          <h2 className="section-title">Record a take</h2>
          <div className="exercise-picker">
            <div className="exercise-controls">
              <button
                className="dice-button"
                type="button"
                disabled={busy || exerciseCategoryId === "custom"}
                onClick={rerollExercise}
                aria-label="Reroll exercise"
                title="Reroll exercise"
              >
                <FaDice aria-hidden="true" />
              </button>
              <label>
                <span className="field-label">
                  Exercise
                  <HelpTip text="Pick what this recording should practice. The app saves the selected exercise with the take for context." />
                </span>
                <StyledSelect
                  label="Exercise"
                  value={exerciseCategoryId}
                  disabled={busy}
                  options={EXERCISE_CATEGORIES.map((category) => ({
                    value: category.id,
                    label: category.label,
                    description:
                      category.id === "custom"
                        ? "Write your own prompt"
                        : "Random prompt pool",
                  }))}
                  onChange={selectExerciseCategory}
                />
              </label>
              {recentExerciseCategoryIds.length > 0 && (
                <div className="exercise-history" aria-label="Previous exercises">
                  {recentExerciseCategoryIds.map((categoryId) => (
                    <button
                      type="button"
                      disabled={busy}
                      key={categoryId}
                      onClick={() => restoreExerciseCategory(categoryId)}
                    >
                      {labelForExerciseCategory(categoryId)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {exerciseCategoryId === "custom" ? (
              <textarea
                className="exercise-custom"
                aria-label="Custom exercise text"
                value={exerciseText}
                disabled={busy}
                placeholder="Type the phrase or script you want to record."
                onChange={(event) => setExerciseText(event.target.value)}
              />
            ) : (
              <p className="record-prompt">{exerciseText}</p>
            )}
          </div>
        </div>
        <div className="record-timer">{formatSeconds(elapsed)}</div>
      </div>

      <div className="record-fields">
        <label>
          <span className="field-label">
            Label
            <HelpTip text="A short name for this take. The default is fine; rename it if you want to remember the context." />
          </span>
          <input
            value={label}
            placeholder={defaultLabel(nextId)}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">
            Register floor
            <HelpTip text="Pitch frames below this threshold count as below-register. Beginner is more forgiving; Hard treats drops below the feminine guide as slips." />
          </span>
          <StyledSelect
            label="Register floor"
            value={registerFloorMode}
            disabled={busy}
            options={[
              {
                value: "beginner",
                label: `Beginner (${REGISTER_FLOOR_PRESETS.beginner} Hz)`,
                description: "More forgiving floor for early practice",
              },
              {
                value: "hard",
                label: `Hard (${REGISTER_FLOOR_PRESETS.hard} Hz)`,
                description: "Stricter feminine-guide floor",
              },
              {
                value: "custom",
                label: "Other (custom)",
                description: "Enter an exact Hz value",
              },
            ]}
            onChange={(mode) => {
              setRegisterFloorMode(mode);
              if (mode !== "custom") setRegisterFloor(REGISTER_FLOOR_PRESETS[mode]);
            }}
          />
        </label>
        {registerFloorMode === "custom" && (
          <label>
            <span className="field-label">
              Custom Hz
              <HelpTip text="Use this when you know the exact pitch floor you want the register charts and insight rules to use." />
            </span>
            <input
              type="number"
              min={80}
              max={260}
              step={1}
              value={registerFloor}
              disabled={busy}
              onChange={(event) => setRegisterFloor(Number(event.target.value))}
            />
          </label>
        )}
      </div>

      <div className="level-meter" aria-label="Microphone level">
        <span style={{ width: `${Math.round(level * 100)}%` }} />
      </div>

      {previewUrl && state !== "recording" && (
        <audio className="record-preview" controls src={previewUrl} />
      )}

      <div className="record-actions">
        {state !== "recording" && !blob && (
          <button className="record-primary" disabled={state === "analyzing"} onClick={startRecording}>
            Start recording
          </button>
        )}
        {state === "recording" && (
          <button className="record-primary" onClick={stopRecording}>
            Stop
          </button>
        )}
        {blob && state !== "recording" && (
          <>
            {state === "analyzing" && (
              <button onClick={cancelAnalysis}>
                Cancel analysis
              </button>
            )}
            <button className="record-primary" disabled={state === "analyzing"} onClick={saveTake}>
              {state === "analyzing" ? "Analyzing" : "Save take"}
            </button>
            <button disabled={state === "analyzing"} onClick={retake}>
              Record again
            </button>
          </>
        )}
      </div>

      {diagnostic && <p className="record-status">{diagnostic}</p>}
      {error && <p className="record-error">{error}</p>}
    </section>
  );
}

async function decodeToMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextCtor();
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const samples = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) samples[i] += data[i] / buffer.numberOfChannels;
    }
    return { samples, sampleRate: buffer.sampleRate };
  } finally {
    await audioContext.close();
  }
}

function formatSeconds(seconds: number): string {
  const safe = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const whole = Math.floor(safe % 60);
  return `${minutes}:${whole.toString().padStart(2, "0")}`;
}

function defaultLabel(nextId: number): string {
  return `New Recording (${nextId})`;
}

function modeForRegisterFloor(floor: number): RegisterFloorMode {
  if (floor === REGISTER_FLOOR_PRESETS.beginner) return "beginner";
  if (floor === REGISTER_FLOOR_PRESETS.hard) return "hard";
  return "custom";
}

function pickExercise(
  categoryId: PresetExerciseCategoryId,
  avoidText = "",
): string {
  const exercises = EXERCISE_LIBRARY[categoryId];
  if (exercises.length === 0) return "";
  if (exercises.length === 1) return exercises[0];

  let next = exercises[Math.floor(Math.random() * exercises.length)];
  if (next === avoidText) {
    const index = exercises.indexOf(next);
    next = exercises[(index + 1) % exercises.length];
  }
  return next;
}

function makeExerciseNote(categoryId: ExerciseCategoryId, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const category = EXERCISE_CATEGORIES.find((item) => item.id === categoryId);
  return `Exercise: ${category?.label ?? "Custom"} - ${trimmed}`;
}

function labelForExerciseCategory(categoryId: ExerciseCategoryId): string {
  return (
    EXERCISE_CATEGORIES.find((category) => category.id === categoryId)?.label ??
    "Exercise"
  );
}

function isExercisePickerSetting(value: unknown): value is ExercisePickerSetting {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExercisePickerSetting>;
  return (
    isExerciseCategoryId(candidate.categoryId) &&
    typeof candidate.text === "string" &&
    Array.isArray(candidate.recentCategoryIds) &&
    candidate.recentCategoryIds.every(isExerciseCategoryId)
  );
}

function isExerciseCategoryId(value: unknown): value is ExerciseCategoryId {
  return (
    typeof value === "string" &&
    EXERCISE_CATEGORIES.some((category) => category.id === value)
  );
}

function StyledSelect<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: StyledSelectOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  function choose(nextValue: T) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div
      className="styled-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? "Choose"}</span>
        <span className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="select-menu" id={listboxId} role="listbox">
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-option${option.value === value ? " is-selected" : ""}`}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
            >
              <span className="select-option-label">{option.label}</span>
              {option.description && (
                <span className="select-option-desc">{option.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      ?
      <span role="tooltip">{text}</span>
    </span>
  );
}
