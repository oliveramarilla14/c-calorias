# Backlog

## Build speed (Railway)
- Convertir el repo en un npm workspace único (frontend + backend como workspaces)
  en vez de dos `npm install` separados en el build (`npm --prefix frontend install && ... && npm --prefix backend install && ...`).
  Una sola resolución de dependencias con node_modules compartido debería acortar el build.
- Cambiar `npm install` por `npm ci` en los scripts de build (usa el lockfile directo, sin
  resolver de nuevo — más rápido y determinístico).
