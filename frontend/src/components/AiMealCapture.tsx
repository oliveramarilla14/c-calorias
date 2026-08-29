import { useRef, useState } from "react";
import { api } from "../api";
import type { AiMealDraft } from "../types";

type Status = "idle" | "recording" | "loading" | "error";

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
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  function stopTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void submitAudio(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      autoStopRef.current = window.setTimeout(() => stopRecording(), 60000);
    } catch {
      setError("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
      setStatus("error");
    }
  }

  function stopRecording() {
    stopTimers();
    mediaRecorderRef.current?.stop();
  }

  async function submitAudio(blob: Blob) {
    setStatus("loading");
    try {
      const draft = await api.parseMealFromAudio(blob);
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
