# Contador de Calorías — Diseño v1

## Resumen

Web app personal (single-user, protegida por PIN numérico ya que la
app va a estar públicamente accesible en internet) para registrar
comidas con descripción y calorías (calculadas por el usuario fuera de
la app), ver el progreso diario contra un objetivo fijo de 2000 cal,
revisar un resumen semanal comparativo, y llevar un seguimiento de
peso semanal (recordatorio los viernes).

## Alcance v1

Incluye:
- Registro de comidas (tipo, descripción, calorías, foto opcional)
- Vista diaria (hoy): objetivo vs. consumido, lista de comidas del día
- Edición y borrado de comidas
- Resumen semanal: total/promedio de la semana, gráfico de últimas N
  semanas, promedio de calorías por tipo de comida
- Registro y edición/borrado de peso semanal, con recordatorio visual
  los viernes si no se cargó peso esa semana
- Histórico de peso
- Acceso protegido por PIN numérico de 4 dígitos, con sesión recordada

Fuera de alcance v1 (explícitamente no se construye ahora):
- Multi-usuario (sigue siendo una sola cuenta/PIN, no hay tabla de
  usuarios ni registro de nuevas cuentas)
- Registro de alimentos individuales / base de datos nutricional
- Notificaciones push o recordatorios fuera de la app
- Edición del objetivo calórico diario desde la UI (queda fijo en
  2000, configurable solo por variable de entorno/constante)

## Stack técnico

- **Frontend:** React + Vite + TypeScript, mobile-first responsive
- **Backend:** Node.js + Express + TypeScript, API REST
- **Base de datos:** PostgreSQL (provisionado en Railway)
- **Fotos:** Cloudflare R2 (S3-compatible), subida vía backend con URL
  firmada; el registro de comida guarda solo la `photo_url`
- **Deploy:** Railway (backend + Postgres); frontend servido como
  build estático desde el mismo servicio o como servicio Railway
  aparte

## Modelo de datos

```sql
meals
  id            serial primary key
  type          text not null   -- 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other'
  description   text not null
  calories      integer not null check (calories > 0)
  photo_url     text null
  consumed_at   date not null   -- fecha del día que corresponde la comida
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()

weights
  id            serial primary key
  weight_kg     numeric(5,2) not null check (weight_kg > 0)
  recorded_at   date not null
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
```

No hay tabla de usuarios ni de objetivo (el objetivo diario es una
constante de configuración: `DAILY_CALORIE_GOAL=2000`).

La semana se calcula lunes→domingo a partir de `consumed_at` /
`recorded_at`.

## Autenticación

App pública en internet protegida por un PIN numérico de 4 dígitos,
sin tabla de usuarios:

- El PIN (hasheado, ej. bcrypt) se guarda en una variable de entorno
  del backend (`PIN_HASH`), no en la base de datos.
- `POST /auth/login` recibe el PIN, lo compara contra el hash; si
  coincide, emite una cookie de sesión `httpOnly`, `secure`,
  `sameSite=lax` firmada (JWT o similar) con expiración de 30 días.
- Todas las rutas de la API (`/meals`, `/weights`, `/summary`,
  `/uploads`) requieren esa cookie de sesión válida; sin ella devuelven
  401 y el frontend redirige a la pantalla de login.
- **Rate limiting:** dado que un PIN de 4 dígitos tiene poca entropía
  (10.000 combinaciones) y la app es pública, `POST /auth/login`
  limita a 5 intentos fallidos por IP cada 15 minutos (429 al superarlo).
- `POST /auth/logout` invalida la cookie (borra/expira del lado
  cliente; si se usa JWT sin estado, simplemente se limpia la cookie).

### 0. Login
- Pantalla inicial si no hay sesión válida: input numérico de 4
  dígitos, auto-submit al completar los 4 dígitos o botón "Entrar"
- Mensaje de error si el PIN es incorrecto o si se superó el límite de
  intentos (con tiempo de espera indicado)

## Pantallas

### 1. Hoy (home)
- Objetivo diario (2000 cal), total consumido hoy, restante
  (consumido - objetivo, con indicador visual si se pasó)
- Lista de comidas de hoy: tipo, descripción, calorías, miniatura de
  foto si existe; acciones editar / borrar por ítem
- Botón "+ Registrar comida"
- Banner de recordatorio de peso: visible si es viernes y no existe un
  registro de `weights` con `recorded_at` dentro de la semana actual;
  incluye acceso directo al form de peso

### 2. Registrar / editar comida
- Campos: tipo (select: Desayuno/Almuerzo/Merienda/Cena/Snack), fecha
  (default hoy), descripción (texto libre), calorías (número > 0),
  foto (opcional, input file)
- Si falla la subida de la foto, la comida se guarda igual sin foto
  (la foto nunca bloquea el registro)

### 3. Resumen semanal
- Total y promedio diario de la semana actual
- Gráfico (barras) del total de calorías de las últimas N semanas
  (N configurable, default 8)
- Promedio de calorías por tipo de comida en la semana actual (para
  identificar dónde recortar, ej. "tus cenas promedian 750 cal")

### 4. Peso
- Form para cargar peso (fecha default hoy, kg)
- Histórico: lista y gráfico de línea de peso a lo largo del tiempo
- Editar / borrar registros de peso

## API (REST)

```
POST   /auth/login                   { pin } -> setea cookie de sesión
POST   /auth/logout                  limpia la cookie de sesión

GET    /meals?date=YYYY-MM-DD       lista de comidas de un día
GET    /meals?week=YYYY-MM-DD       lista de comidas de la semana que contiene esa fecha
POST   /meals                        crear comida
PUT    /meals/:id                    editar comida
DELETE /meals/:id                    borrar comida

GET    /weights                      histórico completo
POST   /weights                      crear registro de peso
PUT    /weights/:id                  editar registro de peso
DELETE /weights/:id                  borrar registro de peso

GET    /summary/weekly?weeks=N       agregados: total/promedio semana actual,
                                      serie de últimas N semanas,
                                      promedio por tipo de comida

POST   /uploads                      sube foto a R2, devuelve { photo_url }
```

## Manejo de errores

- Validación en backend: `calories > 0`, `weight_kg > 0`, `type` debe
  ser uno de los valores permitidos. Errores de validación devuelven
  400 con mensaje descriptivo por campo.
- Frontend muestra los errores de validación inline en el formulario
  correspondiente.
- Fallo en subida de foto: se loguea el error, la comida se guarda sin
  `photo_url`, y se informa al usuario que la foto no se pudo subir
  pero la comida quedó registrada.
- Errores 5xx genéricos: mensaje de error no bloqueante (toast) con
  opción de reintentar.
- 401 en cualquier request a la API (sesión inválida o expirada):
  frontend redirige a la pantalla de login.
- 429 en `/auth/login` (rate limit superado): frontend muestra mensaje
  indicando que hay que esperar antes de reintentar.

## Testing

- Backend: tests unitarios de la lógica de agregación semanal (cálculo
  de semana lunes-domingo, promedios por tipo, serie de N semanas) y
  tests de integración de los endpoints CRUD de `meals` y `weights`
  contra una base de datos de test. Tests de auth: login con PIN
  correcto/incorrecto, rate limiting, y que rutas protegidas devuelvan
  401 sin sesión.
- Frontend: tests de componentes clave (formulario de comida, cálculo
  de "restante" en la vista Hoy) si el tiempo lo permite; no es
  bloqueante para v1.
- No se incluye E2E automatizado en v1 dado el alcance acotado
  (single-user, sin flujos críticos de pago o auth).
