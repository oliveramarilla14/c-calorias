import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { AiMealDraft } from "../types";

type Status = "idle" | "recording" | "loading" | "error";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function extensionForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm") return "webm";
  if (base === "audio/mp4") return "mp4";
  if (base === "audio/ogg") return "ogg";
  return "webm";
}

export function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8" />
    </svg>
  );
}

export function AiMealCapture({ onClose, onDraft }: { onClose: () => void; onDraft: (draft: AiMealDraft) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  function stopTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }

  // Ensure the mic is released and no pending timers/callbacks fire if the
  // component is unmounted (e.g. parent closes the modal) mid-recording.
  useEffect(() => {
    return () => {
      stopTimers();
      // Detach handlers so a stray stop event can't trigger submitAudio/onDraft
      // after the component is gone.
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
      setStatus("error");
      return;
    }
    try {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const actualMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        void submitAudio(blob, `audio.${extensionForMimeType(actualMimeType)}`);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      autoStopRef.current = window.setTimeout(() => stopRecording(), 60000);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("No se pudo iniciar la grabación en este navegador.");
      setStatus("error");
    }
  }

  function stopRecording() {
    stopTimers();
    mediaRecorderRef.current?.stop();
  }

  async function submitAudio(blob: Blob, filename: string) {
    setStatus("loading");
    try {
      const draft = await api.parseMealFromAudio(blob, filename);
      onDraft(draft);
    } catch {
      setError("No se pudo interpretar el audio. Probá de nuevo o cargalo manualmente.");
      setStatus("error");
    }
  }

  async function submitText() {
    if (!text.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const draft = await api.parseMealFromText(text.trim());
      onDraft(draft);
    } catch {
      setError("No se pudo interpretar el texto. Probá de nuevo o cargalo manualmente.");
      setStatus("error");
    }
  }

  const busy = status === "loading" || status === "recording";

  return (
    <div className="sheet-overlay">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>Contame qué comiste</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
        <button
          type="button"
          onClick={status === "recording" ? stopRecording : startRecording}
          disabled={status === "loading"}
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: status === "recording" ? "var(--color-accent)" : "var(--color-surface)",
            color: status === "recording" ? "var(--color-bg)" : "var(--color-text)",
            cursor: status === "loading" ? "default" : "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          }}
        >
          <MicIcon size={36} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-muted)", textAlign: "center" }}>
          {status === "recording" && `Grabando… ${recordSeconds}s (toca para terminar)`}
          {status === "loading" && "Analizando…"}
          {status === "idle" && "Toca para grabar"}
          {status === "error" && "Toca para reintentar"}
        </div>

        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, color: "var(--color-muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
          o escribí
          <div style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Comí una milanesa con papas fritas y una coca"
          disabled={busy}
          style={{ width: "100%", padding: 12, fontSize: 16, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)", resize: "none" }}
        />
        <button
          type="button"
          onClick={submitText}
          disabled={busy || !text.trim()}
          style={{ width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: busy ? "default" : "pointer", opacity: status === "loading" ? 0.7 : 1 }}
        >
          Interpretar texto
        </button>

        {error && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>{error}</div>}
      </div>
    </div>
  );
}
