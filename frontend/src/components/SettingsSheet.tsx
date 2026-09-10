import { useEffect, useState } from "react";
import { api } from "../api";
import type { AiKeyStatus } from "../types";
import { addDays, localISODate } from "../format";

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

const secondaryBtn: React.CSSProperties = {
  minHeight: 48,
  padding: "0 18px",
  background: "transparent",
  border: "2px solid var(--color-divider)",
  color: "var(--color-text)",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function sanitizePin(v: string) {
  return v.replace(/\D/g, "").slice(0, 4);
}

function sanitizeCalories(v: string) {
  return v.replace(/\D/g, "").slice(0, 5);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden selection copy.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function SettingsSheet({ onClose, onGoalsSaved }: { onClose: () => void; onGoalsSaved?: (dailyGoal: number) => void }) {
  const [ai, setAi] = useState<AiKeyStatus | null>(null);

  const [dailyGoal, setDailyGoal] = useState("");
  const [maintenance, setMaintenance] = useState("");
  const [goalsMsg, setGoalsMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [goalsSaving, setGoalsSaving] = useState(false);

  const [exportFrom, setExportFrom] = useState(() => addDays(localISODate(), -29));
  const [exportTo, setExportTo] = useState(() => localISODate());
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

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
      .then((s) => {
        setAi(s.ai);
        setDailyGoal(String(s.goals.dailyGoal));
        setMaintenance(String(s.goals.maintenanceCalories));
      })
      .catch(() => setKeyMsg({ kind: "err", text: "No se pudo cargar la configuración." }));
  }, []);

  async function saveGoals() {
    setGoalsMsg(null);
    const goal = Number(dailyGoal);
    const maint = Number(maintenance);
    if (!goal || !maint || goal < 500 || maint < 500 || goal > 10000 || maint > 10000) {
      setGoalsMsg({ kind: "err", text: "Ingresá valores entre 500 y 10.000 kcal." });
      return;
    }
    setGoalsSaving(true);
    try {
      const s = await api.updateGoals({ dailyGoal: goal, maintenanceCalories: maint });
      setDailyGoal(String(s.goals.dailyGoal));
      setMaintenance(String(s.goals.maintenanceCalories));
      onGoalsSaved?.(s.goals.dailyGoal);
      setGoalsMsg({ kind: "ok", text: "Objetivos guardados." });
    } catch {
      setGoalsMsg({ kind: "err", text: "No se pudieron guardar los objetivos." });
    } finally {
      setGoalsSaving(false);
    }
  }

  async function generateExport() {
    setExportMsg(null);
    setExportText(null);
    if (exportFrom > exportTo) {
      setExportMsg({ kind: "err", text: "La fecha inicial no puede ser posterior a la final." });
      return;
    }
    setExporting(true);
    try {
      const { rows } = await api.exportRange(exportFrom, exportTo);
      if (rows.length === 0) {
        setExportMsg({ kind: "err", text: "No hay datos registrados en ese rango." });
        return;
      }
      const lines = ["fecha,calorias,peso", ...rows.map((r) => `${r.date},${r.calories},${r.weightKg ?? ""}`)];
      setExportText(lines.join("\n"));
      setExportMsg({ kind: "ok", text: `${rows.length} días exportados.` });
    } catch {
      setExportMsg({ kind: "err", text: "No se pudieron obtener los datos." });
    } finally {
      setExporting(false);
    }
  }

  async function copyExport() {
    if (!exportText) return;
    const ok = await copyText(exportText);
    setExportMsg(
      ok
        ? { kind: "ok", text: "Copiado al portapapeles." }
        : { kind: "err", text: "No se pudo copiar. Seleccioná el texto manualmente." },
    );
  }

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
          <h5 style={sectionTitleStyle}>Objetivos de calorías</h5>
          <label>
            <span style={labelStyle}>Objetivo diario (kcal)</span>
            <input
              type="text"
              inputMode="numeric"
              value={dailyGoal}
              placeholder="2000"
              onChange={(e) => setDailyGoal(sanitizeCalories(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>Mantenimiento (kcal)</span>
            <input
              type="text"
              inputMode="numeric"
              value={maintenance}
              placeholder="2500"
              onChange={(e) => setMaintenance(sanitizeCalories(e.target.value))}
              style={inputStyle}
            />
          </label>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", lineHeight: 1.5 }}>
            El objetivo es lo que apuntás a consumir por día. El mantenimiento es lo que gastás sin subir ni bajar de
            peso, y se usa para calcular el déficit semanal.
          </span>
          <button
            type="button"
            disabled={goalsSaving || !dailyGoal || !maintenance}
            onClick={saveGoals}
            style={{ ...primaryBtn, opacity: goalsSaving || !dailyGoal || !maintenance ? 0.6 : 1 }}
          >
            {goalsSaving ? "Guardando…" : "Guardar objetivos"}
          </button>
          {msgNode(goalsMsg)}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h5 style={sectionTitleStyle}>PIN de acceso</h5>
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

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h5 style={sectionTitleStyle}>Exportar datos</h5>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", lineHeight: 1.5 }}>
            Elegí un rango de fechas y copiá el detalle en formato CSV: fecha, calorías del día y peso registrado.
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 130px" }}>
              <span style={labelStyle}>Desde</span>
              <input type="date" value={exportFrom} max={exportTo} onChange={(e) => setExportFrom(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ flex: "1 1 130px" }}>
              <span style={labelStyle}>Hasta</span>
              <input type="date" value={exportTo} min={exportFrom} onChange={(e) => setExportTo(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={exporting}
              onClick={generateExport}
              style={{ ...primaryBtn, opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? "Generando…" : "Generar"}
            </button>
            {exportText && (
              <button type="button" onClick={copyExport} style={secondaryBtn}>
                Copiar
              </button>
            )}
          </div>
          {exportText && (
            <textarea
              readOnly
              value={exportText}
              onFocus={(e) => e.currentTarget.select()}
              rows={10}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 13,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                lineHeight: 1.6,
                background: "var(--color-surface)",
                color: "var(--color-text)",
                border: "2px solid var(--color-divider)",
                resize: "vertical",
                whiteSpace: "pre",
              }}
            />
          )}
          {msgNode(exportMsg)}
        </section>
      </div>
    </div>
  );
}
