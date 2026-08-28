import { useState } from "react";
import { api } from "../api";
import type { Weight } from "../types";

export function WeightSheet({ weight, onClose, onSaved }: { weight: Weight | null; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(weight?.recordedAt ?? new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState(weight?.weightKg ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = parseFloat(kg);
    if (!value || value <= 0) {
      setError("Ingresá un peso valido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (weight) {
        await api.updateWeight(weight.id, { weightKg: value, recordedAt: date });
      } else {
        await api.createWeight({ weightKg: value, recordedAt: date });
      }
      onSaved();
    } catch {
      setError("No se pudo guardar el peso. Probá de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>{weight ? "Editar peso" : "Cargar peso"}</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", minHeight: 50, fontSize: 16, fontWeight: 600, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }} />
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Peso en kg</span>
          <input
            className="np"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="0.0"
            style={{ width: "100%", minHeight: 64, fontSize: 34, fontWeight: 800, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}
          />
        </label>
        <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Un registro por semana es suficiente. Los viernes te lo recordamos en Hoy.</p>
      </div>
      <div style={{ padding: "14px 20px", borderTop: "2px solid var(--color-divider)" }}>
        {error && <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>{error}</div>}
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{ width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Guardando…" : "Guardar peso"}
        </button>
      </div>
    </div>
  );
}
