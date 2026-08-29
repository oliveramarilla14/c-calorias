# Carga de comidas por voz / lenguaje natural — Design

## Problema

Hoy cargar una comida requiere completar manualmente tipo, descripción y
calorías. El usuario quiere poder decir (por audio) o escribir en lenguaje
natural lo que comió (ej. "comí una milanesa con papas fritas y una coca")
y que la app interprete eso para prellenar el formulario, estimando las
calorías automáticamente.

## Alcance

- Nuevo endpoint backend que recibe audio o texto libre y devuelve una
  comida estructurada (tipo, descripción, calorías estimadas).
- Nuevo punto de entrada en el frontend (FAB) que graba audio o acepta
  texto libre, llama al endpoint, y abre el formulario de comida (`MealSheet`)
  ya prellenado para que el usuario revise y guarde.
- No cambia el modelo de datos de `Meal` ni el flujo de guardado existente.
- No incluye edición por voz de comidas ya guardadas, ni multi-idioma
  (queda en español, igual que el resto de la app).

## Arquitectura / flujo de datos

```
[FAB "🎤" en TodayScreen]
        │ tap
        ▼
[AiMealCapture modal] ── graba audio (MediaRecorder) o texto libre
        │ POST /api/ai/parse-meal (multipart: audio file O campo text)
        ▼
backend: ai.routes.ts
  ├─ si hay audio → OpenAI Whisper (transcripción) → texto
  └─ texto → OpenAI gpt-4o-mini, JSON estructurado
             { type: MealType, description: string, calories: int }
        │ 200 JSON
        ▼
[MealSheet se abre con ese draft precargado] ── usuario revisa/edita, "Guardar"
        │ POST/PUT /api/meals (sin cambios)
        ▼
se guarda como cualquier otra comida
```

La comida nunca se guarda automáticamente: el resultado de la IA solo
prellena el formulario existente, que sigue validando y guardando igual
que hoy.

## Backend

### Config

- Nuevo env var requerido: `OPENAI_API_KEY` en `backend/src/config.ts`,
  siguiendo el mismo patrón `required()` que las demás claves.
- Nueva dependencia: `openai` (SDK oficial de Node).

### `backend/src/ai/ai.service.ts`

- `transcribeAudio(buffer: Buffer, mimetype: string): Promise<string>`
  — llama a la API de transcripción de Whisper de OpenAI y devuelve el
  texto transcripto.
- `interpretMealText(text: string): Promise<{ type: MealType; description: string; calories: number }>`
  — llama a chat completions (`gpt-4o-mini`) pidiendo salida JSON
  estructurada, restringida a los valores de `MEAL_TYPES`, una
  descripción limpia en español, y una estimación entera de calorías.
  Si la respuesta no matchea el schema esperado, tira un error tipado
  (`AiParseError`) que la ruta traduce a 502.

### `backend/src/ai/ai.routes.ts`

- `POST /api/ai/parse-meal`, montado con la misma auth middleware de
  sesión que el resto de las rutas.
- `multer` con `memoryStorage`, campo `audio` (mismo límite de 8MB que
  fotos), y campo de texto `text` opcional en el body.
- Reglas:
  - Si viene `audio`: transcribe primero, después interpreta el texto
    transcripto.
  - Si viene `text` (y no `audio`): interpreta directo.
  - Si no viene ninguno: `400 { error: "missing_input" }`.
  - Si OpenAI falla (red, cuota, timeout): `502 { error: "ai_failed" }`,
    logueando el error igual que se hace en `uploads.routes.ts`.
- Responde `200` con `{ type, description, calories, transcript? }`
  (`transcript` solo si vino de audio, para que el frontend lo pueda
  mostrar como referencia).

## Frontend

### `AiMealCapture` (nuevo componente, modal/sheet)

- Botón de micrófono grande que usa `MediaRecorder` para grabar
  (`audio/webm;codecs=opus`), con corte automático a los 60s.
- Alternativa: textarea + botón "Interpretar" para texto libre.
- Estados: idle → grabando/escribiendo → "Analizando…" (loading) →
  éxito (cierra y abre `MealSheet` con el draft) o error (mensaje
  inline + botón reintentar).
- Manejo de errores específicos: permiso de micrófono denegado, fallo
  de red al subir, fallo de la IA (502 del backend).

### FAB en `TodayScreen` / `App.tsx`

- Nuevo botón (ícono de micrófono) junto al botón primario existente
  ("Registrar comida"): en mobile, botón circular chico cerca de la
  barra inferior; en desktop, segundo botón en el sidebar.
- Al tocarlo abre `AiMealCapture`.

### `MealSheet`

- Nuevo prop opcional `draft?: { type: MealType; description: string; calories: number }`,
  usado solo para seedear el estado inicial cuando `meal` es `null`
  (no toca el flujo de edición). El usuario puede editar cualquier
  campo antes de guardar, igual que si lo hubiera tipeado a mano.

### `api.ts`

- `api.parseMealFromAudio(blob: Blob): Promise<AiMealDraft>`
- `api.parseMealFromText(text: string): Promise<AiMealDraft>`

Ambos pegan a `POST /api/ai/parse-meal` con `FormData` (audio como
archivo, o texto como campo).

## Testing

- Backend: tests unitarios de `ai.service.ts` mockeando el cliente de
  OpenAI (mismo patrón que los tests existentes con vitest). Tests de
  ruta para `/api/ai/parse-meal`: éxito con texto, éxito con audio
  (mockeado), sin input (400), fallo upstream (502).
- Frontend: no hay test automatizado razonable para grabación de audio
  real (requiere permisos de micrófono del browser). Se verifica
  manualmente vía `claude-in-chrome` una vez implementado: flujo de
  texto libre end-to-end, y al menos una revisión visual del flujo de
  grabación (el permiso real de mic puede no ser automatizable en el
  entorno de test, en cuyo caso se deja la verificación de audio en
  manos del usuario).

## Riesgos / decisiones abiertas

- Costo de OpenAI por request: bajo volumen esperado (app personal),
  no se agrega rate limiting dedicado en esta iteración.
- Estimación de calorías por IA es aproximada por naturaleza — por eso
  el diseño fuerza revisión manual antes de guardar (no se guarda
  directo).
