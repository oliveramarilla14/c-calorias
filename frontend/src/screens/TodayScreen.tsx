import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import type { Meal, AiMealDraft } from "../types";
import { MealListItem } from "../components/MealListItem";
import { MealSheet } from "../components/MealSheet";
import { AiMealCapture, MicIcon } from "../components/AiMealCapture";
import { useBackButtonClose } from "../useBackButtonClose";
import { formatDate, localISODate, addDays } from "../format";

const dayNavBtnStyle: React.CSSProperties = {
  minWidth: 36,
  minHeight: 36,
  padding: 0,
  fontSize: 16,
  fontWeight: 800,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "2px solid var(--color-divider)",
  cursor: "pointer",
};

export function TodayScreen({
  dailyGoal,
  showWeightBanner,
  onOpenWeight,
  sheetOpen,
  onCloseSheet,
}: {
  dailyGoal: number;
  showWeightBanner: boolean;
  onOpenWeight: () => void;
  sheetOpen: boolean;
  onCloseSheet: () => void;
}) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [aiCaptureOpen, setAiCaptureOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiMealDraft | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => localISODate());

  const isToday = selectedDate === localISODate();

  const reload = useCallback(async () => {
    setMeals(await api.getMealsByDate(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    reload();
  }, [reload]);

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const pct = Math.min(100, Math.round((consumed / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - consumed);

  const mealSheetVisible = sheetOpen || editing !== null || aiDraft !== null;
  function closeMealSheet() {
    setEditing(null);
    setAiDraft(null);
    onCloseSheet();
  }
  // A single back-button handler for both sheets. Using two separate
  // useBackButtonClose instances made the AI capture -> draft handoff race
  // on the shared history stack: closing the AI sheet ran history.back()
  // while the meal sheet pushed a new entry, and the resulting popstate
  // closed the freshly-opened draft sheet immediately.
  useBackButtonClose(aiCaptureOpen || mealSheetVisible, () => {
    if (aiCaptureOpen) setAiCaptureOpen(false);
    else closeMealSheet();
  });

  return (
    <div>
      <section style={{ padding: "20px 20px 18px", borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>
            {isToday ? "Consumido hoy" : "Consumido"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              aria-label="Día anterior"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              style={dayNavBtnStyle}
            >
              ‹
            </button>
            <input
              type="date"
              value={selectedDate}
              max={localISODate()}
              onChange={(e) => setSelectedDate(e.target.value || localISODate())}
              style={{
                minHeight: 36,
                padding: "0 10px",
                fontSize: 13,
                fontWeight: 700,
                background: "var(--color-surface)",
                color: "var(--color-text)",
                border: "2px solid var(--color-divider)",
              }}
            />
            <button
              type="button"
              aria-label="Día siguiente"
              disabled={isToday}
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              style={{ ...dayNavBtnStyle, opacity: isToday ? 0.4 : 1, cursor: isToday ? "default" : "pointer" }}
            >
              ›
            </button>
          </div>
        </div>
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
          <h6>{isToday ? "Comidas de hoy" : `Comidas del ${formatDate(selectedDate)}`}</h6>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>{meals.length} registros</span>
        </div>
        {meals.map((m) => (
          <MealListItem
            key={m.id}
            meal={m}
            onEdit={() => setEditing(m)}
            onDelete={async () => {
              await api.deleteMeal(m.id);
              reload();
            }}
          />
        ))}
        {meals.length === 0 && <div style={{ padding: "28px 20px", borderTop: "1px solid var(--color-neutral-300)", color: "var(--color-muted)" }}>{isToday ? "Todavía no registraste nada hoy." : "No hay comidas registradas en esta fecha."}</div>}
      </section>

      {mealSheetVisible && (
        <MealSheet
          meal={editing}
          defaultDate={selectedDate}
          draft={editing ? undefined : aiDraft}
          onClose={closeMealSheet}
          onSaved={() => {
            setEditing(null);
            setAiDraft(null);
            onCloseSheet();
            reload();
          }}
        />
      )}

      <div className="ai-fab-wrap">
        <button type="button" className="ai-fab" onClick={() => setAiCaptureOpen(true)} aria-label="Cargar comida por voz">
          <MicIcon />
        </button>
      </div>

      {aiCaptureOpen && (
        <AiMealCapture
          onClose={() => setAiCaptureOpen(false)}
          onDraft={(draft) => {
            setAiCaptureOpen(false);
            setAiDraft(draft);
          }}
        />
      )}
    </div>
  );
}
