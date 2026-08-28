import { useState } from "react";
import { api } from "../api";
import { MEAL_TYPES, type Meal, type MealType } from "../types";

export function MealSheet({ meal, onClose, onSaved }: { meal: Meal | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<MealType>(meal?.type ?? "Almuerzo");
  const [description, setDescription] = useState(meal?.description ?? "");
  const [calories, setCalories] = useState(meal ? String(meal.calories) : "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsedCalories = parseInt(calories, 10);
    if (!description.trim()) {
      setError("Escribí una descripción.");
      return;
    }
    if (!Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      setError("Ingresá una cantidad de calorías mayor a 0.");
      return;
    }

    setSaving(true);
    setError(null);
    setPhotoWarning(null);
    let photoUrl = meal?.photoUrl ?? null;
    if (photoFile) {
      try {
        photoUrl = await api.uploadPhoto(photoFile);
      } catch {
        setPhotoWarning("No se pudo subir la foto, pero la comida se va a guardar igual.");
      }
    }
    const input = {
      type,
      description: description.trim(),
      calories: parsedCalories,
      photoUrl,
      consumedAt: meal?.consumedAt ?? new Date().toISOString().slice(0, 10),
    };
    try {
      if (meal) {
        await api.updateMeal(meal.id, input);
      } else {
        await api.createMeal(input);
      }
      onSaved();
    } catch {
      setError("No se pudo guardar la comida. Probá de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--color-bg)", display: "flex", flexDirection: "column", animation: "sheetUp 220ms ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--color-divider)" }}>
        <h4>{meal ? "Editar comida" : "Registrar comida"}</h4>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, background: "transparent", border: 0, color: "var(--color-text)", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Tipo de comida</span>
          <select value={type} onChange={(e) => setType(e.target.value as MealType)} style={{ width: "100%", minHeight: 50, fontSize: 16, fontWeight: 600, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Descripción</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Pollo grillé con ensalada y papas al horno"
            style={{ width: "100%", padding: 12, fontSize: 16, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)", resize: "none" }}
          />
        </label>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Calorías</span>
          <input
            className="np"
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            style={{ width: "100%", minHeight: 56, fontSize: 28, fontWeight: 800, background: "var(--color-surface)", color: "var(--color-text)", border: "2px solid var(--color-divider)" }}
          />
        </label>
        <div>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 7 }}>Foto (opcional)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 14, border: "2px solid var(--color-divider)", padding: 12, cursor: "pointer" }}>
            <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{photoFile?.name ?? "Agregar foto del plato"}</span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          </label>
          {photoWarning && <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--color-accent)" }}>{photoWarning}</span>}
        </div>
      </div>
      <div style={{ padding: "14px 20px", borderTop: "2px solid var(--color-divider)" }}>
        {error && <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ minHeight: 52, padding: "0 18px", background: "transparent", border: "2px solid var(--color-divider)", color: "var(--color-text)", fontWeight: 800, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            style={{ flex: 1, minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Guardando…" : "Guardar comida"}
          </button>
        </div>
      </div>
    </div>
  );
}
