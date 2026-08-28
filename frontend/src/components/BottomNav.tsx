type Screen = "hoy" | "semana" | "peso";

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const tabs: { key: Screen; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "peso", label: "Peso" },
  ];
  return (
    <nav style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--color-neutral-300)" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            minHeight: 56,
            background: "transparent",
            border: 0,
            borderTop: `3px solid ${screen === t.key ? "var(--color-accent)" : "transparent"}`,
            fontWeight: 800,
            fontSize: 12,
            textTransform: "uppercase",
            color: screen === t.key ? "var(--color-text)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
