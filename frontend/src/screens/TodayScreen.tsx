import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import type { Meal } from "../types";
import { MealListItem } from "../components/MealListItem";
import { MealSheet } from "../components/MealSheet";

export function TodayScreen({ dailyGoal, showWeightBanner, onOpenWeight }: { dailyGoal: number; showWeightBanner: boolean; onOpenWeight: () => void }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);

  const reload = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    setMeals(await api.getMealsByDate(today));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const pct = Math.min(100, Math.round((consumed / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - consumed);

  return (
    <div>
      <section style={{ padding: "20px 20px 18px", borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>Consumido hoy</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 64, lineHeight: 0.9 }}>{consumed}</span>
          <span style={{ fontWeight: 600, fontSize: 16, color: "var(--color-muted)" }}>/ {dailyGoal} cal</span>
        </div>
        <div style={{ height: 14, background: "var(--color-neutral-300)", marginTop: 18 }}>
          <div style={{ height: "100%", background: "var(--color-accent)", width: `${pct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginTop: 18, background: "var(--color-divider)" }}>
          <div style={{ background: "var(--color-bg)", paddingRight: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Restante</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>{remaining}</div>
          </div>
          <div style={{ background: "var(--color-bg)", paddingLeft: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Comidas</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>{meals.length}</div>
          </div>
        </div>
      </section>

      {showWeightBanner && (
        <section style={{ background: "var(--color-accent)", color: "var(--color-bg)", padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", opacity: 0.85 }}>Viernes de peso</div>
          <div style={{ fontWeight: 800, fontSize: 30, margin: "6px 0 14px" }}>Esta semana todavía no cargaste tu peso.</div>
          <button
            type="button"
            onClick={onOpenWeight}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 48, padding: "0 16px", background: "var(--color-bg)", color: "var(--color-text)", border: 0, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
          >
            Cargar peso ahora
          </button>
        </section>
      )}

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 10px" }}>
          <h6>Comidas de hoy</h6>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>{meals.length} registros</span>
        </div>
        {meals.map((m) => (
          <MealListItem
            key={m.id}
            meal={m}
            onEdit={() => {
              setEditing(m);
              setSheetOpen(true);
            }}
            onDelete={async () => {
              await api.deleteMeal(m.id);
              reload();
            }}
          />
        ))}
        {meals.length === 0 && <div style={{ padding: "28px 20px", borderTop: "1px solid var(--color-neutral-300)", color: "var(--color-muted)" }}>Todavía no registraste nada hoy.</div>}
      </section>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 70, padding: 14 }}>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          style={{ display: "block", width: "100%", maxWidth: 430, margin: "0 auto", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
        >
          + Registrar comida
        </button>
      </div>

      {sheetOpen && (
        <MealSheet
          meal={editing}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
