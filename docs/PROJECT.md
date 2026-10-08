# C-Calorias

- **Fecha:** 2026-10-07 (reconstruido; el proyecto arrancó el 2026-08-28)
- **Estado:** Aprobado

## Qué es

App personal (PLATO) para registrar lo que se come y controlar las
calorías del día contra un objetivo, ver cómo viene la semana y llevar
el peso semanal.

## Para quién

Oliver, solo. Desde el celular como PWA, varias veces por día al
registrar cada comida y una vez por semana para el peso (los viernes).

## Tipo

| Campo | Valor |
|---|---|
| `ui` | custom-design |
| `audience` | personal |
| `device` | mobile |

## Punto de partida

Las calorías se calculaban fuera de la app y no había un registro
ordenado. La app tiene que hacer rápido el registro (incluso por voz) y
mostrar el progreso diario y semanal sin cuentas a mano.

## Conceptos y modelo

- **Meal** (`meals`): una comida de un día (`consumedAt`), con tipo
  (`breakfast`, `lunch`, `snack`, `dinner`, `other`), descripción,
  calorías, foto opcional (`photoUrl`) y si fue fuera de la dieta
  (`offDiet`).
- **Weight** (`weights`): un registro de peso en kg con su fecha
  (`recordedAt`). Se espera uno por semana.
- **Setting** (`settings`): clave/valor para la configuración que se
  cambia desde la app: hash del PIN, API key de OpenAI, objetivo diario
  (`daily_goal`, 2000 por defecto) y calorías de mantenimiento
  (`maintenance_calories`, 2500 por defecto).
- **Semana:** lunes a domingo, calculada sobre `consumedAt` y
  `recordedAt` en la zona horaria local de la app.
- **Déficit semanal:** lo consumido contra el mantenimiento, traducido
  a kilos a razón de 7700 kcal/kg.

## Decisiones

- **Un solo usuario con PIN de 4 dígitos**, sin tabla de usuarios: la
  app es pública en internet y la usa una sola persona. Cookie
  `httpOnly` firmada (JWT) por 30 días y rate limiting de 5 intentos
  fallidos por IP cada 15 minutos.
- **Las calorías las pone el usuario** o las estima la IA; no hay base
  de datos nutricional.
- **Carga por voz o texto con IA (OpenAI):** Whisper transcribe y un
  modelo chico interpreta la comida; la IA solo prellena el formulario
  y el usuario confirma antes de guardar.
- **La foto nunca bloquea el registro:** si falla la subida a R2, la
  comida se guarda sin foto.
- **Configuración en la base:** PIN, API key y objetivos se cambian
  desde la app sin redeploy; la variable de entorno queda como valor
  inicial.
- **Un solo servicio en producción:** el backend sirve el build del
  frontend.
- **Stack Node + Express + TypeScript con Prisma**, anterior al Brain;
  se mantiene. Excepción registrada en `AGENTS.md`.

## Fuera de alcance

- Multiusuario: lo usa una sola persona.
- Alimentos individuales o base nutricional: el registro es por comida.
- Notificaciones push: el recordatorio de peso es un banner en la app.
- Editar comidas guardadas por voz.

## Roadmap

Fases y MVP → `docs/ROADMAP.md`.
