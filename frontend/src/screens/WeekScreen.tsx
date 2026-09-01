import { useEffect, useState } from "react";
import { api } from "../api";
import type { WeeklySummary } from "../types";
import { formatDate } from "../format";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return WEEKDAY_LABELS[day === 0 ? 6 : day - 1];
}

const CHART_HEIGHT = 170;
const BAR_MAX_HEIGHT = 140;

function DailyCaloriesChart({ days }: { days: WeeklySummary["days"] }) {
  const maxTotal = Math.max(...days.map((d) => d.total), 1);
  const weighDays = days.filter((d) => d.weightKg !== null);
  const weights = weighDays.map((d) => Number(d.weightKg));
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 0;
  const weightRange = maxW - minW || 1;

  // leave headroom so the weight line doesn't collide with the calorie bars
  const yFor = (w: number) => 10 + (1 - (w - minW) / weightRange) * (BAR_MAX_HEIGHT - 20);
  const xFor = (i: number) => ((i + 0.5) / days.length) * 100;

  return (
    <div style={{ position: "relative", height: CHART_HEIGHT, borderBottom: "2px solid var(--color-divider)" }}>
      {weighDays.length > 0 && (
        <svg
          viewBox={`0 0 100 ${BAR_MAX_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 30, width: "100%", height: BAR_MAX_HEIGHT, overflow: "visible" }}
        >
          {weighDays.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              points={weighDays.map((d) => `${xFor(days.indexOf(d))},${yFor(Number(d.weightKg))}`).join(" ")}
            />
          )}
          {weighDays.map((d) => (
            <circle
              key={d.date}
              cx={xFor(days.indexOf(d))}
              cy={yFor(Number(d.weightKg))}
              r={2.5}
              vectorEffect="non-scaling-stroke"
              fill="var(--color-accent)"
            />
          ))}
        </svg>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: "100%" }}>
        {days.map((d, i) => (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, height: "100%" }}>
            <div style={{ fontSize: 10, fontWeight: 800, textAlign: "center" }}>{d.total > 0 ? d.total : ""}</div>
            <div
              style={{
                background: i === days.length - 1 ? "var(--color-accent)" : "var(--color-neutral-800)",
                height: Math.round((d.total / maxTotal) * BAR_MAX_HEIGHT),
                opacity: 0.55,
              }}
            />
            <div style={{ fontSize: 10, fontWeight: 600, textAlign: "center", color: "var(--color-muted)" }}>{weekdayLabel(d.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeekScreen({ weeksCount }: { weeksCount: number }) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    api.getWeeklySummary(weeksCount).then(setSummary);
  }, [weeksCount]);

  if (!summary) return null;

  const maxWeekAvg = Math.max(...summary.weeks.map((w) => w.avg), 1);
  const maxType = Math.max(...summary.byType.map((t) => t.avg), 1);
  const hasWeights = summary.days.some((d) => d.weightKg !== null);
  const maxTopMeal = Math.max(...summary.topMeals.map((m) => m.calories), 1);

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>
          Semana actual · {formatDate(summary.weekStart)} – {formatDate(summary.weekEnd)}
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
        <h6>Calorías por día</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 16 }}>
          Semana actual{hasWeights ? " · con peso registrado" : ""}
        </div>
        <DailyCaloriesChart days={summary.days} />
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6>Últimas {summary.weeks.length} semanas</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 16 }}>Promedio diario por semana</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, borderBottom: "2px solid var(--color-divider)" }}>
          {summary.weeks.map((w, i) => (
            <div key={w.weekStart} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, height: "100%" }}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{w.avg}</div>
              <div
                style={{
                  background: i === summary.weeks.length - 1 ? "var(--color-accent)" : "var(--color-neutral-800)",
                  height: Math.round((w.avg / maxWeekAvg) * 140),
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6>Comidas más calóricas</h6>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 14 }}>Top 5 de la semana actual</div>
        {summary.topMeals.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Todavía no hay comidas registradas esta semana.</div>
        )}
        {summary.topMeals.map((m, i) => (
          <div key={m.id} style={{ padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--color-neutral-300)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.description}
              </span>
              <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>{m.calories} CAL</span>
            </div>
            <div style={{ height: 8, background: "var(--color-neutral-300)" }}>
              <div style={{ height: "100%", background: i === 0 ? "var(--color-accent)" : "var(--color-neutral-800)", width: `${Math.round((m.calories / maxTopMeal) * 100)}%` }} />
            </div>
          </div>
        ))}
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
