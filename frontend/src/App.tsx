import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WeekScreen } from "./screens/WeekScreen";
import { WeightScreen } from "./screens/WeightScreen";
import { BottomNav } from "./components/BottomNav";
import { AuthError } from "./api";

type Screen = "hoy" | "semana" | "peso";

const DAILY_GOAL = 2000;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState<Screen>("hoy");
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [todayKey, setTodayKey] = useState(0); // bump to force TodayScreen to refetch after a weight save

  function handleAuthError(err: unknown) {
    if (err instanceof AuthError) setLoggedIn(false);
  }

  window.onunhandledrejection = (e) => handleAuthError(e.reason);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  const isFriday = new Date().getDay() === 5;

  return (
    <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", margin: "0 auto", background: "var(--color-bg)", position: "relative", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "14px 20px 10px", borderBottom: "2px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 18, height: 18, background: "var(--color-accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 19 }}>PLATO</span>
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: 150 }}>
        {screen === "hoy" && (
          <TodayScreen
            key={todayKey}
            dailyGoal={DAILY_GOAL}
            showWeightBanner={isFriday}
            onOpenWeight={() => {
              setScreen("peso");
              setWeightSheetOpen(true);
            }}
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

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--color-bg)", borderTop: "2px solid var(--color-divider)" }}>
        <div style={{ padding: "14px 20px" }}>
          <button
            type="button"
            onClick={() => (screen === "peso" ? setWeightSheetOpen(true) : setScreen("hoy"))}
            style={{ display: "block", width: "100%", minHeight: 52, background: "var(--color-accent)", color: "var(--color-bg)", border: 0, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
          >
            {screen === "peso" ? "Cargar peso" : "Registrar comida"}
          </button>
        </div>
        <BottomNav screen={screen} onChange={setScreen} />
      </div>
    </div>
  );
}
