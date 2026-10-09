# AGENTS.md — C-Calorias

App personal (PLATO) para registrar comidas y calorías, seguir el
objetivo diario, el resumen semanal y el peso. Un solo usuario con PIN;
se usa desde el celular.

## Reglas globales

Las reglas de trabajo de Oliver están en el Engineering Brain:
`~/projects/engineering-brain/AGENTS.md`. **Leelo antes de empezar.**
Si esa ruta no existe en esta máquina, avisá y no sigas sin él.
En lo específico de este proyecto, este archivo le gana al Brain.

## Este proyecto

- Ficha en el Brain: `05-Projects/C-Calorias.md` (fase, versión, tipo de
  UI, audiencia, dispositivo).
- Qué es, para quién y decisiones del proyecto: `docs/PROJECT.md`.
- Roadmap: `docs/ROADMAP.md`.
- Features: `docs/features/NNN-<tema>/` (`spec.md`, `plan.md`). Cualquier
  herramienta que guarde specs o planes en otra carpeta (por ejemplo
  `docs/superpowers/`) usa esta en su lugar.

## Comandos

```bash
make dev        # PostgreSQL (docker-compose.dev.yml) + API (tsx watch) + web (Vite)
make test       # tests del backend y del frontend (vitest)
make lint       # lint del frontend (oxlint)
make migrate    # migraciones (prisma migrate deploy)
make generate   # cliente de Prisma
make build      # build de producción (frontend + backend)
```

## Reglas que no se negocian

- Commits en Conventional Commits, en inglés, **sin atribución de IA**
  (ni `Co-Authored-By` ni firmas), aunque la herramienta la agregue por
  defecto: esta regla le gana.
- Código en inglés (identificadores, tablas, endpoints, comentarios);
  UI en el idioma de sus usuarios.
- Nunca secretos en el repo; la configuración va en el módulo de
  configuración.
- Ninguna implementación sin spec o diseño aprobado.
- Si el Brain no cubre algo o dos notas se contradicen: avisale a Oliver
  y registralo en `00-Core/Brain Findings.md` del Brain, con el formato
  completo de esa nota. No lo resuelvas en silencio.

## Específico de este proyecto

- **Proyecto anterior al Brain** (arrancó el 2026-08-28). Se está
  alineando con el Brain en documentación y estructura, sin cambiar el
  stack.
- **Backend en Node, no en Go:** Node + Express + TypeScript con Prisma
  (`backend/`). Excepción a `02-Stack/Backend` del Brain: el proyecto
  está en producción y reescribirlo no aporta (decisión de Oliver,
  2026-10-07). Las reglas de Go del Brain (pgx, sqlc, goose, estructura
  `cmd/` + `internal/`) no aplican; el resto del Brain sí.
- **Frontend:** React + Vite + TypeScript en `frontend/`, CSS propio
  (sistema de diseño PLATO, sin Tailwind ni shadcn/ui). En producción el
  backend sirve el build del frontend: un solo servicio en Railway.
- **Deploy:** Railway con Nixpacks (`railway.json`).
- **Versión** (ADR-0006 del Brain):
  cada push a `main` sube la versión. La fuente es `VERSION` en la raíz;
  Vite la inyecta y la app la muestra junto al logo
  (`frontend/src/version.ts`). Cada push lleva `VERSION` actualizado,
  una entrada en `CHANGELOG.md` (1 a 4 puntos en lenguaje de usuario),
  el commit `chore: release vX.Y.Z`, el tag anotado `vX.Y.Z` y
  `git push --follow-tags`.
