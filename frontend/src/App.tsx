import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  return <div style={{ padding: 20 }}>Sesión iniciada.</div>;
}
