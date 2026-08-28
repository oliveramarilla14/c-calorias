import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Weight } from "../types";
import { WeightSheet } from "../components/WeightSheet";
import { formatDate } from "../format";

export function WeightScreen({ sheetOpen, onCloseSheet }: { sheetOpen: boolean; onCloseSheet: () => void }) {
  const [weights, setWeights] = useState<Weight[]>([]);
  const [editing, setEditing] = useState<Weight | null>(null);

  const reload = useCallback(async () => {
    setWeights(await api.getWeights());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (weights.length === 0) {
    return (
      <div style={{ padding: 28, color: "var(--color-muted)" }}>
        Todavía no cargaste ningún peso.
        {sheetOpen && (
          <WeightSheet
            weight={null}
            onClose={onCloseSheet}
            onSaved={() => {
              onCloseSheet();
              reload();
            }}
          />
        )}
      </div>
    );
  }

  const kgs = weights.map((w) => parseFloat(w.weightKg));
  const lo = Math.min(...kgs) - 0.4;
  const hi = Math.max(...kgs) + 0.4;
  const px = (i: number) => (weights.length > 1 ? (i / (weights.length - 1)) * 320 + 3 : 163);
  const py = (kg: number) => 140 - ((kg - lo) / (hi - lo)) * 138;
  const last = weights[weights.length - 1];
  const prev = weights[weights.length - 2];
  const delta = prev ? parseFloat(last.weightKg) - parseFloat(prev.weightKg) : 0;
  const points = weights.map((w, i) => `${px(i)},${py(parseFloat(w.weightKg))}`).join(" ");

  return (
    <div>
      <section style={{ padding: 20, borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 6 }}>Último registro · {formatDate(last.recordedAt)}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 64 }}>{parseFloat(last.weightKg).toFixed(1)}</span>
          <span style={{ fontWeight: 600, fontSize: 18, color: "var(--color-muted)" }}>kg</span>
          <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "var(--color-accent-700)" }}>
            {prev ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg vs. anterior` : "—"}
          </span>
        </div>
      </section>

      <section style={{ padding: "18px 20px 22px", borderBottom: "2px solid var(--color-divider)" }}>
        <h6 style={{ marginBottom: 14 }}>Histórico</h6>
        <svg viewBox="0 0 330 140" style={{ width: "100%", height: 150, overflow: "visible" }}>
          <line x1="0" y1="140" x2="330" y2="140" stroke="var(--color-divider)" strokeWidth={2} />
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
          {weights.map((w, i) => (
            <rect key={w.id} x={px(i) - 3.5} y={py(parseFloat(w.weightKg)) - 3.5} width={7} height={7} fill="var(--color-accent)" />
          ))}
        </svg>
      </section>

      <section style={{ padding: "16px 20px 8px" }}>
        <h6>Registros</h6>
        {weights
          .slice()
          .reverse()
          .map((w, i, arr) => {
            const p = arr[i + 1];
            const d = p ? parseFloat(w.weightKg) - parseFloat(p.weightKg) : null;
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderTop: "1px solid var(--color-neutral-300)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--color-muted)" }}>{formatDate(w.recordedAt)}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 19 }}>{parseFloat(w.weightKg).toFixed(1)} kg</span>
                  <span style={{ fontWeight: 600, fontSize: 12, color: d !== null && d > 0 ? "var(--color-accent-700)" : "var(--color-muted)" }}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                  </span>
                  <button type="button" onClick={() => setEditing(w)} style={{ background: "transparent", border: 0, color: "var(--color-accent)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteWeight(w.id);
                      reload();
                    }}
                    style={{ background: "transparent", border: 0, color: "var(--color-muted)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
                  >
                    Borrar
                  </button>
                </span>
              </div>
            );
          })}
      </section>

      {(sheetOpen || editing) && (
        <WeightSheet
          weight={editing}
          onClose={() => {
            setEditing(null);
            onCloseSheet();
          }}
          onSaved={() => {
            setEditing(null);
            onCloseSheet();
            reload();
          }}
        />
      )}
    </div>
  );
}
