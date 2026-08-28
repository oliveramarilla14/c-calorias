import { useState } from "react";
import { api } from "../api";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(value: string) {
    setLoading(true);
    setError(null);
    try {
      await api.login(value);
      onSuccess();
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        setError("Demasiados intentos. Esperá unos minutos.");
      } else {
        setError("PIN incorrecto.");
      }
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4) submit(digits);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
        <span style={{ fontWeight: 800, fontSize: 22 }}>PLATO</span>
      </div>
      <input
        autoFocus
        inputMode="numeric"
        type="password"
        value={pin}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: 180,
          minHeight: 64,
          textAlign: "center",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "0.4em",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          border: "2px solid var(--color-divider)",
          borderRadius: 0,
        }}
        placeholder="····"
      />
      {error && <span style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: 13 }}>{error}</span>}
    </div>
  );
}
