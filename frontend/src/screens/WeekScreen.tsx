import { useEffect, useState } from "react";
import { api } from "../api";
import type { WeeklySummary } from "../types";

export function WeekScreen({ weeksCount }: { weeksCount: number }) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    api.getWeeklySummary(weeksCount).then(setSummary);
  }, [weeksCount]);

  if (!summary) return null;

  const maxWeek = Math.max(...summary.weeks.map((w) => w.total), 1);
  const maxType = Math.max(...summary.byType.map((t) => t.avg), 1);

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>
          Semana actual · {summary.weekStart} – {summary.weekEnd}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-divider)" }}>
          <div style={{ background: "var(--color-bg)", paddingRight: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{summary.weekTotal}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Total semana</div>
          </div>
          <div style={{ background: "var(--color-bg)", paddingLeft: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{summary.weekAvg}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Promedio diario</div>
          </div>
        </div>
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6>Últimas {summary.weeks.length} semanas</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 16 }}>Total de calorías por semana</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, borderBottom: "2px solid var(--color-divider)" }}>
          {summary.weeks.map((w, i) => (
            <div key={w.weekStart} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, height: "100%" }}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{(w.total / 1000).toFixed(1)}k</div>
              <div
                style={{
                  background: i === summary.weeks.length - 1 ? "var(--color-accent)" : "var(--color-neutral-800)",
                  height: Math.round((w.total / maxWeek) * 140),
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "18px 20px 8px" }}>
        <h6>Promedio por tipo de comida</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 14 }}>Dónde conviene recortar</div>
        {summary.byType.map((t) => (
          <div key={t.type} style={{ padding: "11px 0", borderTop: "1px solid var(--color-neutral-300)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{t.type}</span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{t.avg} CAL</span>
            </div>
            <div style={{ height: 10, background: "var(--color-neutral-300)" }}>
              <div style={{ height: "100%", background: t.avg === maxType && t.avg > 0 ? "var(--color-accent)" : "var(--color-neutral-800)", width: `${Math.round((t.avg / maxType) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
