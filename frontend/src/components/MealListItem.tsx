import type { Meal } from "../types";

export function MealListItem({ meal, onEdit, onDelete }: { meal: Meal; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 20px", borderTop: "1px solid var(--color-neutral-300)" }}>
      {meal.photoUrl ? (
        <img
          src={meal.photoUrl}
          alt={meal.description}
          style={{ width: 52, height: 52, flex: "none", objectFit: "cover", background: "var(--color-neutral-300)" }}
        />
      ) : (
        <div
          style={{
            width: 52,
            height: 52,
            flex: "none",
            background: "var(--color-neutral-300)",
            display: "flex",
            alignItems: "flex-end",
            padding: 5,
            fontWeight: 800,
            fontSize: 13,
            color: "var(--color-muted)",
          }}
        >
          {meal.type.slice(0, 3).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
          {meal.type}
        </div>
        <div style={{ fontWeight: 500, lineHeight: 1.3, marginTop: 2 }}>{meal.description}</div>
        <div style={{ display: "flex", gap: 2, marginTop: 6, marginLeft: -4 }}>
          <button
            type="button"
            onClick={onEdit}
            style={{ minHeight: 34, padding: "0 8px", background: "transparent", border: 0, color: "var(--color-accent)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer" }}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{ minHeight: 34, padding: "0 8px", background: "transparent", border: 0, color: "var(--color-muted)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer" }}
          >
            Borrar
          </button>
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 20, textAlign: "right", flex: "none" }}>
        {meal.calories}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block" }}>CAL</span>
      </div>
    </div>
  );
}
