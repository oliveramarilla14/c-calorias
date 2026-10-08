# Roadmap — C-Calorias

## Fase actual: — (mantenimiento)

## Fases

### Fase 1 — Anterior al Brain  ✅ v1.4.1 · cerrada 2026-10-07
**Demo:** se puede entrar con el PIN, registrar una comida a mano o por
voz (con foto), ver el día contra el objetivo, la semana con déficit y
peso, cargar el peso del viernes y exportar a CSV.
**Entorno:** production (personal)
**Features:**
- [x] 001 — contador de calorías v1 (MVP: PIN, comidas, Hoy, Semana,
  Peso, fotos en R2, PWA) → docs/features/001-calorie-counter/
- [x] 002 — carga de comidas por voz o texto con IA →
  docs/features/002-ai-meal-capture/
**Cambios durante la fase:** reconstruida el 2026-10-07 desde el
historial de git; el proyecto no tenía roadmap. Sin specs, directo en
`main`:
- `v1.0.0`–`v1.0.1` (2026-08-28): MVP y fixes de mobile.
- `v1.1` (2026-09-01): dashboard semanal con calorías por día, peso
  superpuesto y comidas más frecuentes.
- `v1.2` (2026-09-01): botones de día anterior y siguiente.
- `v1.3` (2026-09-10): objetivos configurables, navegación por semana,
  déficit en kilos y export a CSV. `v1.3.1`: días de la semana en la
  zona horaria local.
- `v1.4` (2026-10-07): fecha seleccionada en la vista diaria y comidas
  fuera de la dieta. `v1.4.1`: fecha corta ("Mié 7 oct").

### Fase 2 — <a definir>  📋 planificada
**Demo:** a definir en el triage del Inbox.
**Entorno:** production (personal)

## Inbox

- [idea] Build en Railway: un npm workspace único (frontend + backend)
  en vez de dos `npm install` separados (2026-08-28)
- [idea] Build en Railway: `npm ci` en vez de `npm install` (2026-08-28)
- [rediseño] Renombrar `frontend/` a `web/` como el Brain (2026-10-07)
- [rediseño] Dockerfile multi-stage en vez de `railway.json` con
  Nixpacks (04-Infrastructure/Deploy del Brain) (2026-10-07)
- [rediseño] Sesiones en la base en vez de cookie JWT (ADR-0004 del
  Brain) (2026-10-07)
- [idea] Script `test` en `frontend/package.json` (2026-10-07)

## Descartado

- [rediseño] Reescribir el backend en Go: está en producción y no
  aporta (decisión de Oliver, 2026-10-07)
