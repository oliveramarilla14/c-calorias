import { useEffect, useState } from "react";
import { api } from "../api";
import type { AiKeyStatus } from "../types";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "var(--color-muted)",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  padding: "0 12px",
  fontSize: 16,
  fontWeight: 600,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "2px solid var(--color-divider)",
};

const primaryBtn: React.CSSProperties = {
  minHeight: 48,
  padding: "0 18px",
  background: "var(--color-accent)",
  color: "var(--color-bg)",
  border: 0,
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

function sanitizePin(v: string) {
  return v.replace(/\D/g, "").slice(0, 4);
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [ai, setAi] = useState<AiKeyStatus | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [keyMsg, setKeyMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [keySaving, setKeySaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setAi(s.ai))
      .catch(() => setKeyMsg({ kind: "err", text: "No se pudo cargar la configuración." }));
  }, []);

  async function savePin() {
    setPinMsg(null);
    if (newPin.length !== 4) {
      setPinMsg({ kind: "err", text: "El PIN nuevo debe tener 4 dígitos." });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ kind: "err", text: "El PIN nuevo y la confirmación no coinciden." });
      return;
    }
    setPinSaving(true);
    try {
      await api.updatePin(currentPin, newPin);
      setPinMsg({ kind: "ok", text: "PIN actualizado." });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      setPinMsg({ kind: "err", text: "El PIN actual es incorrecto." });
    } finally {
      setPinSaving(false);
    }
  }

  async function saveKey() {
    setKeyMsg(null);
    if (apiKey.trim().length < 20) {
      setKeyMsg({ kind: "err", text: "La API key parece incompleta." });
      return;
    }
    setKeySaving(true);
    try {
      const s = await api.updateAiKey(apiKey.trim());
      setAi(s.ai);
      setApiKey("");
      setKeyMsg({ kind: "ok", text: "API key guardada." });
    } catch {
      setKeyMsg({ kind: "err", text: "No se pudo guardar la API key." });
    } finally {
      setKeySaving(false);
    }
  }

  async function removeKey() {
    setKeyMsg(null);
    setKeySaving(true);
    try {
      const s = await api.deleteAiKey();
      setAi(s.ai);
      setKeyMsg({ kind: "ok", text: "Se quitó la API key guardada." });
    } catch {
      setKeyMsg({ kind: "err", text: "No se pudo quitar la API key." });
    } finally {
      setKeySaving(false);
    }
  }

  function msgNode(m: { kind: "ok" | "err"; text: string } | null) {
    if (!m) return null;
    return (
      <span
        style={{
          display: "block",
          marginTop: 10,
          fontSize: 13,
          fontWeight: 600,
          color: m.kind === "ok" ? "var(--color-text)" : "var(--color-accent)",
        }}
      >
        {m.text}
      </span>
    );
  }

  const aiStatusText = !ai
    ? "Cargando…"
    : ai.configured
      ? `Configurada (${ai.preview}${ai.source === "env" ? " · desde entorno" : ""})`
      : "Sin configurar";

  return (
    <div className="sheet-overlay">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <h4>Configuración</h4>
        <button
          type="button"
          onClick={onClose}
          style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "18px 20px 28px", display: "flex", flexDirection: "column", gap: 32 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h5 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            PIN de acceso
          </h5>
          <label>
            <span style={labelStyle}>PIN actual</span>
            <input
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(e) => setCurrentPin(sanitizePin(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>PIN nuevo</span>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(sanitizePin(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>Confirmar PIN nuevo</span>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(sanitizePin(e.target.value))}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            disabled={pinSaving || !currentPin || !newPin || !confirmPin}
            onClick={savePin}
            style={{ ...primaryBtn, opacity: pinSaving || !currentPin || !newPin || !confirmPin ? 0.6 : 1 }}
          >
            {pinSaving ? "Guardando…" : "Cambiar PIN"}
          </button>
          {msgNode(pinMsg)}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h5 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            IA (OpenAI)
          </h5>
          <div>
            <span style={labelStyle}>Estado</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{aiStatusText}</span>
          </div>
          <label>
            <span style={labelStyle}>Nueva API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder="sk-…"
              onChange={(e) => setApiKey(e.target.value)}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={keySaving || !apiKey.trim()}
              onClick={saveKey}
              style={{ ...primaryBtn, opacity: keySaving || !apiKey.trim() ? 0.6 : 1 }}
            >
              {keySaving ? "Guardando…" : "Guardar API key"}
            </button>
            {ai?.configured && ai.source === "db" && (
              <button
                type="button"
                disabled={keySaving}
                onClick={removeKey}
                style={{
                  minHeight: 48,
                  padding: "0 18px",
                  background: "transparent",
                  border: "2px solid var(--color-divider)",
                  color: "var(--color-text)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Quitar
              </button>
            )}
          </div>
          {msgNode(keyMsg)}
        </section>
      </div>
    </div>
  );
}
