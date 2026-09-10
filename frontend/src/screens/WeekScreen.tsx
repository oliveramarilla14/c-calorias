import { useEffect, useState } from "react";
import { api } from "../api";
import type { WeeklySummary } from "../types";
import { formatDate, formatKg, formatNumber } from "../format";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return WEEKDAY_LABELS[day === 0 ? 6 : day - 1];
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const navBtnStyle: React.CSSProperties = {
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

// Chart geometry. One SVG keeps the calorie bars and the weight line on a
// shared x axis; the weight gets its own strip below so the two scales can't
// collide the way an overlaid line does.
const VB_WIDTH = 340;
const PLOT_L = 6;
const PLOT_R = 288;
const CAL_TOP = 14;
const CAL_BOTTOM = 150;
const WEIGHT_TOP = 172;
const WEIGHT_BOTTOM = 208;

function WeekChart({ summary }: { summary: WeeklySummary }) {
  const { days, dailyGoal, maintenanceCalories } = summary;
  const weighIns = days.map((d, i) => ({ i, date: d.date, kg: d.weightKg === null ? null : Number(d.weightKg) }))
    .filter((p): p is { i: number; date: string; kg: number } => p.kg !== null);

  const hasWeights = weighIns.length > 0;
  const labelsY = hasWeights ? WEIGHT_BOTTOM + 16 : CAL_BOTTOM + 16;
  const vbHeight = labelsY + 6;

  const slot = (PLOT_R - PLOT_L) / days.length;
  const barWidth = Math.min(26, slot * 0.6);
  const xFor = (i: number) => PLOT_L + slot * (i + 0.5);

  const calMax = Math.max(...days.map((d) => d.total), maintenanceCalories, dailyGoal, 1) * 1.12;
  const yForCal = (v: number) => CAL_BOTTOM - (v / calMax) * (CAL_BOTTOM - CAL_TOP);

  const kgs = weighIns.map((p) => p.kg);
  const minKg = Math.min(...kgs);
  const maxKg = Math.max(...kgs);
  const kgRange = maxKg - minKg || 1;
  // A flat week would sit on the floor of the strip; center it instead.
  const yForKg = (kg: number) =>
    maxKg === minKg
      ? (WEIGHT_TOP + WEIGHT_BOTTOM) / 2
      : WEIGHT_BOTTOM - ((kg - minKg) / kgRange) * (WEIGHT_BOTTOM - WEIGHT_TOP);

  function referenceLine(value: number, label: string, dash: string, opacity: number) {
    const y = yForCal(value);
    return (
      <g opacity={opacity}>
        <line x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray={dash} />
        <text x={PLOT_R + 6} y={y - 2} fontSize={7.5} fontWeight={700} fill="var(--color-muted)">
          {label}
        </text>
        <text x={PLOT_R + 6} y={y + 7} fontSize={8.5} fontWeight={800} fill="var(--color-muted)">
          {formatNumber(value)}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${VB_WIDTH} ${vbHeight}`} width="100%" role="img" aria-label="Calorías y peso por día">
      {referenceLine(maintenanceCalories, "MANT", "1 3", 0.55)}
      {referenceLine(dailyGoal, "OBJ", "4 3", 0.9)}

      {days.map((d, i) => {
        if (d.total <= 0) return null;
        const y = yForCal(d.total);
        const over = d.total > dailyGoal;
        return (
          <g key={d.date}>
            <rect
              x={xFor(i) - barWidth / 2}
              y={y}
              width={barWidth}
              height={CAL_BOTTOM - y}
              fill={over ? "var(--color-accent)" : "var(--color-neutral-800)"}
              opacity={over ? 0.9 : 0.75}
            />
            <text x={xFor(i)} y={y - 4} fontSize={9} fontWeight={800} textAnchor="middle" fill="var(--color-text)">
              {formatNumber(d.total)}
            </text>
          </g>
        );
      })}

      <line x1={PLOT_L} y1={CAL_BOTTOM} x2={PLOT_R} y2={CAL_BOTTOM} stroke="var(--color-divider)" strokeWidth={2} />

      {hasWeights && (
        <g>
          <text x={PLOT_R + 6} y={WEIGHT_TOP + 4} fontSize={7.5} fontWeight={700} fill="var(--color-muted)">
            PESO KG
          </text>
          {weighIns.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={weighIns.map((p) => `${xFor(p.i)},${yForKg(p.kg)}`).join(" ")}
            />
          )}
          {weighIns.map((p) => (
            <g key={p.date}>
              <circle cx={xFor(p.i)} cy={yForKg(p.kg)} r={3} fill="var(--color-accent)" />
              <text
                x={xFor(p.i)}
                y={yForKg(p.kg) - 7}
                fontSize={8.5}
                fontWeight={800}
                textAnchor="middle"
                fill="var(--color-text)"
              >
                {formatKg(p.kg)}
              </text>
            </g>
          ))}
          <line
            x1={PLOT_L}
            y1={WEIGHT_BOTTOM}
            x2={PLOT_R}
            y2={WEIGHT_BOTTOM}
            stroke="var(--color-divider)"
            strokeWidth={2}
          />
        </g>
      )}

      {days.map((d, i) => (
        <text
          key={d.date}
          x={xFor(i)}
          y={labelsY}
          fontSize={9}
          fontWeight={600}
          textAnchor="middle"
          fill="var(--color-muted)"
        >
          {weekdayLabel(d.date)}
        </text>
      ))}
    </svg>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--color-muted)" }}>
      <span
        style={
          dashed
            ? { width: 14, borderTop: `2px dashed ${color}` }
            : { width: 12, height: 10, background: color }
        }
      />
      {label}
    </span>
  );
}

function DeficitCard({ summary }: { summary: WeeklySummary }) {
  const isDeficit = summary.deficit >= 0;
  const kg = Math.abs(summary.deficitKg);

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "2px solid var(--color-divider)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 8 }}>
        {isDeficit ? "Déficit de la semana" : "Superávit de la semana"}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 34, color: isDeficit ? "var(--color-text)" : "var(--color-accent)" }}>
          {formatNumber(Math.abs(summary.deficit))}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--color-muted)" }}>kcal</span>
        <span
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            background: "var(--color-surface)",
            border: "2px solid var(--color-divider)",
            fontWeight: 800,
            fontSize: 15,
            whiteSpace: "nowrap",
          }}
        >
          ≈ {isDeficit ? "−" : "+"}
          {formatKg(kg)} kg
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.5 }}>
        Mantenimiento {formatNumber(summary.maintenanceCalories)} × {summary.daysCounted}{" "}
        {summary.daysCounted === 1 ? "día" : "días"} = {formatNumber(summary.maintenanceTarget)} kcal · consumiste{" "}
        {formatNumber(summary.weekTotal)} kcal.
      </div>
    </div>
  );
}

function weekLabel(offset: number): string {
  if (offset === 0) return "Semana actual";
  if (offset === 1) return "Semana pasada";
  return `Hace ${offset} semanas`;
}

export function WeekScreen({ weeksCount }: { weeksCount: number }) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let active = true;
    api.getWeeklySummary(weeksCount, weekOffset).then((s) => {
      if (active) setSummary(s);
    });
    return () => {
      active = false;
    };
  }, [weeksCount, weekOffset]);

  if (!summary) return null;

  const maxWeekAvg = Math.max(...summary.weeks.map((w) => w.avg), 1);
  const maxType = Math.max(...summary.byType.map((t) => t.avg), 1);
  const hasWeights = summary.days.some((d) => d.weightKg !== null);
  const maxTopMeal = Math.max(...summary.topMeals.map((m) => m.calories), 1);
  const scopeLabel = summary.isCurrentWeek ? "de la semana actual" : `del ${shortDate(summary.weekStart)} al ${shortDate(summary.weekEnd)}`;

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setWeekOffset((o) => o + 1)}
            style={navBtnStyle}
          >
            ‹
          </button>
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {weekLabel(summary.weekOffset)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginTop: 2 }}>
              {formatDate(summary.weekStart)} – {formatDate(summary.weekEnd)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Semana siguiente"
            disabled={summary.isCurrentWeek}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            style={{
              ...navBtnStyle,
              opacity: summary.isCurrentWeek ? 0.4 : 1,
              cursor: summary.isCurrentWeek ? "default" : "pointer",
            }}
          >
            ›
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-divider)" }}>
          <div style={{ background: "var(--color-bg)", paddingRight: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{formatNumber(summary.weekTotal)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Total semana</div>
          </div>
          <div style={{ background: "var(--color-bg)", paddingLeft: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{formatNumber(summary.weekAvg)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>Promedio diario</div>
          </div>
        </div>
        <DeficitCard summary={summary} />
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6>Calorías y peso</h6>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "8px 0 14px" }}>
          <LegendSwatch color="var(--color-neutral-800)" label={`Bajo objetivo (${formatNumber(summary.dailyGoal)})`} />
          <LegendSwatch color="var(--color-accent)" label="Sobre objetivo" />
          {hasWeights && <LegendSwatch color="var(--color-accent)" label="Peso (kg)" dashed />}
        </div>
        <WeekChart summary={summary} />
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
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted)", marginBottom: 14 }}>Top 5 {scopeLabel}</div>
        {summary.topMeals.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No hay comidas registradas en esta semana.</div>
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
