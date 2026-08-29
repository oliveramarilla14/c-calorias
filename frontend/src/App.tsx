import { useEffect, useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WeekScreen } from "./screens/WeekScreen";
import { WeightScreen } from "./screens/WeightScreen";
import { BottomNav } from "./components/BottomNav";
import { SettingsSheet } from "./components/SettingsSheet";
import { useBackButtonClose } from "./useBackButtonClose";
import { api, AuthError } from "./api";

type Screen = "hoy" | "semana" | "peso";
type Theme = "dark" | "light";

const DAILY_GOAL = 2000;
const THEME_STORAGE_KEY = "plato-theme";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H13a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V13z" />
    </svg>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [screen, setScreen] = useState<Screen>("hoy");
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [todayKey, setTodayKey] = useState(0); // bump to force TodayScreen to refetch after a weight save
  const [hasWeighedThisWeek, setHasWeighedThisWeek] = useState(true);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useBackButtonClose(settingsOpen, () => setSettingsOpen(false));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }, [theme]);

  useEffect(() => {
    api
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    api
      .getWeeklySummary(1)
      .then((summary) => setHasWeighedThisWeek(summary.hasWeighedThisWeek))
      .catch(() => {});
  }, [loggedIn, todayKey]);

  function handleAuthError(err: unknown) {
    if (err instanceof AuthError) setLoggedIn(false);
  }

  window.onunhandledrejection = (e) => handleAuthError(e.reason);

  if (checkingSession) {
    return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  }

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  const isFriday = new Date().getDay() === 5;

  function primaryAction() {
    if (screen === "peso") {
      setWeightSheetOpen(true);
    } else if (screen === "hoy") {
      setMealSheetOpen(true);
    } else {
      setScreen("hoy");
      setMealSheetOpen(true);
    }
  }

  const primaryLabel = screen === "peso" ? "Cargar peso" : "Registrar comida";

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 19 }}>PLATO</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setSettingsOpen(true)}
                aria-label="Configuración"
              >
                <GearIcon />
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label="Cambiar tema"
              >
                <ThemeIcon theme={theme} />
              </button>
            </div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {([
              ["hoy", "Hoy"],
              ["semana", "Semana"],
              ["peso", "Peso"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScreen(key)}
                style={{
                  textAlign: "left",
                  minHeight: 44,
                  padding: "0 12px",
                  background: screen === key ? "var(--color-surface)" : "transparent",
                  border: 0,
                  borderLeftWidth: 3,
                  borderLeftStyle: "solid",
                  borderLeftColor: screen === key ? "var(--color-accent)" : "transparent",
                  color: screen === key ? "var(--color-text)" : "var(--color-muted)",
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={primaryAction}
          style={{ minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
        >
          {primaryLabel}
        </button>
      </aside>

      <div className="app-main">
        <header
          className="mobile-only"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "14px 20px 10px", borderBottom: "2px solid var(--color-divider)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
            <span style={{ fontWeight: 800, fontSize: 19 }}>PLATO</span>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Cambiar tema"
          >
            <ThemeIcon theme={theme} />
          </button>
        </header>

        <main style={{ flex: 1, paddingBottom: 150 }}>
          {screen === "hoy" && (
            <TodayScreen
              key={todayKey}
              dailyGoal={DAILY_GOAL}
              showWeightBanner={isFriday && !hasWeighedThisWeek}
              onOpenWeight={() => {
                setScreen("peso");
                setWeightSheetOpen(true);
              }}
              sheetOpen={mealSheetOpen}
              onCloseSheet={() => setMealSheetOpen(false)}
            />
          )}
          {screen === "semana" && <WeekScreen weeksCount={8} />}
          {screen === "peso" && (
            <WeightScreen
              sheetOpen={weightSheetOpen}
              onCloseSheet={() => {
                setWeightSheetOpen(false);
                setTodayKey((k) => k + 1);
              }}
            />
          )}
        </main>

        <div
          className="mobile-only"
          style={{ position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 430, margin: "0 auto", background: "var(--color-bg)", borderTop: "2px solid var(--color-divider)" }}
        >
          <div style={{ padding: "14px 20px" }}>
            <button
              type="button"
              onClick={primaryAction}
              style={{ display: "block", width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
            >
              {primaryLabel}
            </button>
          </div>
          <BottomNav screen={screen} onChange={setScreen} />
        </div>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
