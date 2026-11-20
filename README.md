# GameConsole

Consola web del Proyecto 2 de Lenguajes de Programación. Hospeda tres videojuegos funcionales, permite partidas simultáneas y envía los eventos de cada movimiento a **GameStats**, que conserva la validación, el almacenamiento y el análisis. El panel solo consulta esos resultados.

- **Frontend:** Vite + React + TypeScript. La lógica de los juegos está en clases TypeScript; React solo dibuja la interfaz.
- **IA:** Conecta 4 con minimax alfa-beta implementado en **SWI-Prolog**.
- **Integración:** Nginx sirve la SPA y hace proxy same-origin de `/api` y `/prolog`, por lo que no se necesita CORS.
- **GameStats:** proyecto independiente (`../GameStats`). GameConsole no valida, almacena ni calcula estadísticas.

## Arquitectura

```
Navegador
  └─ SPA React+TS
       ├─ /api/*     ── Nginx ──> gamestats-go:8080   (eventos, /stats, /analysis)
       └─ /prolog/*  ── Nginx ──> prolog:8090         (/health, /decide)
```

GameStats conserva su propia arquitectura Go + Scala y puede ejecutarse por separado. El `docker-compose.yml` de GameConsole construye el stack integrado usando los Dockerfiles de `../GameStats`.

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Contrato de eventos](docs/contrato-eventos.md)
- [Despliegue y operación](docs/despliegue.md)
- [Guion de la demostración](docs/guion-video.md)

## Inicio rápido (stack integrado)

### Requisitos previos

- Docker Desktop o Docker Engine 24+ con Compose v2.
- Los repositorios `GameConsole` y `GameStats` como hermanos en disco.
- `GameStats` en la rama `feature/gameconsole-integration` mientras no se integre en `main`; el Compose construye el checkout local.
- Node.js 22+ solo para ejecutar pruebas o el smoke test desde el host; el stack integrado no lo requiere.
- Puertos `8088` y `8090` libres, o valores distintos en `.env`.

```
Lenguajes-Programacion/
  GameStats/
  GameConsole/
```

```bash
cd GameConsole
cp .env.example .env   # opcional: WEB_PORT y PROLOG_PORT
docker compose up -d --build --wait
docker compose ps
```

Abrir <http://localhost:8088>. El puerto se puede cambiar con `WEB_PORT`.

### Windows PowerShell

```powershell
Set-Location "C:\ruta\a\Lenguajes-Programacion\GameConsole"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose down --remove-orphans
docker compose up -d --build --wait
docker compose ps
```

Comprobar salud y abrir la consola:

```powershell
$web = Invoke-WebRequest -Uri "http://localhost:8088/healthz" -UseBasicParsing
$api = Invoke-RestMethod -Uri "http://localhost:8088/api/health"
$prolog = Invoke-RestMethod -Uri "http://localhost:8088/prolog/health"
[pscustomobject]@{ Web = $web.StatusCode; GameStats = $api.status; Prolog = $prolog.status } | Format-List
Start-Process "http://localhost:8088"
```

Verificación automática por HTTP (eventos, Prolog, análisis y `/stats`):

```powershell
node scripts/smoke.mjs
```

Para detener el stack: `docker compose down`.

## Modo desarrollo

1. Levantar GameStats desde su repo:

   ```bash
   cd ../GameStats
   docker compose up -d
   ```

2. Levantar Prolog (expone `127.0.0.1:8090`):

   ```bash
   cd ../GameConsole
   docker compose up -d prolog
   ```

3. Levantar Vite con proxies a `localhost:8080` y `localhost:8090`:

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Abrir <http://localhost:5173>.

## Juegos

| `gameId` | Juego | Flujo | Eventos principales |
| --- | --- | --- | --- |
| `racing` | Carrera por turnos | Humano vs CPU, 2 vueltas, avanzar o turbo con riesgo | `MATCH_STARTED`, `PLAYER_JOINED`, `POSITION_CHANGED`, `LAP_COMPLETED`, `MATCH_FINISHED` |
| `combat` | Duelo táctico | Humano vs CPU, ataque / escopeta / defensa / curación | `PLAYER_ATTACKED`, `PLAYER_ELIMINATED`, `MATCH_FINISHED` |
| `connect4` | Conecta 4 | Humano vs IA en Prolog, tablero 6×7 | `MOVE`, `AI_DECISION`, `MATCH_FINISHED` |

Cada partida usa `matchId = gc-<gameId>-<uuid>` y `eventId` único. La cola FIFO de cada partida espera el `MATCH_STARTED`, envía en orden y se detiene al finalizar.

## Panel

- `GET /api/stats` → totales y `byGame` (partidas, finalizadas, activas, analizadas, eventos, jugadores).
- `GET /api/matches/{id}/analysis` → `patterns` y `statistics` calculados por GameStats.
- Polling cada 3 s; la consola no recalcula nada.
- El registro usa una clave de `localStorage` por partida y se fusiona con `gameconsole.matches.v1`; el panel lo relee cada 3 s. El lobby muestra solo las sesiones de la pestaña actual.

## Endpoints internos

| Desde el navegador | Destino | Notas |
| --- | --- | --- |
| `/api/*` | `gamestats-go:8080/*` | Nginx elimina el prefijo `/api` |
| `/prolog/health` | `prolog:8090/health` | Salud de SWI-Prolog |
| `/prolog/decide` | `prolog:8090/decide` | `{board, player, depth}` → `{column, score, nodes, depth, ms}` |

## Pruebas

```powershell
# Frontend
Set-Location web
npm ci
npm test
npm run lint
npm run build

# Prolog
Set-Location ..
docker run --rm -v "${PWD}\prolog:/app" -w /app swipl:9.2.9 `
  swipl -q -g run_tests -t halt tests.pl

# Integración (stack arriba)
node scripts/smoke.mjs
```

`npm test` ejecuta las pruebas unitarias y de integración del frontend; la prueba
`live` se omite si el stack no está levantado. El smoke test requiere el stack
arriba y Node.js 22+.

## CI/CD

- `.github/workflows/ci.yml`: tests y build del frontend, pruebas plunit y job `integration` que clona GameStats, construye las cuatro imágenes, levanta el stack y ejecuta el smoke test.
- `.github/workflows/deploy.yml`: despliegue manual por SSH en la VM; actualiza GameConsole y el repo hermano `../GameStats` antes de reconstruir.
  Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`.
- `scripts/deploy.sh`: alternativa en la VM (`SKIP_GIT_PULL=1` para omitir la actualización de ambos repos).
- Azure Container Apps: despliegue preview ejecutado y verificado. URL pública: `https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`. Recursos, configuración definitiva, pruebas y cierre de la exposición temporal de backends: [deploy/aca/README.md](deploy/aca/README.md).

Ver [docs/despliegue.md](docs/despliegue.md).

## Estructura

```
GameConsole/
  docker-compose.yml
  prolog/                 # SWI-Prolog: servidor HTTP, reglas y minimax
  web/
    nginx.conf            # SPA + proxy same-origin
    src/core/             # OOP: BaseGame, juegos, cola, clientes, registro
    src/ui/               # React: lobby, tablero, log, panel
    src/core/__tests__/   # Vitest
  scripts/                # smoke.mjs, deploy.sh
  docs/                   # arquitectura, contrato de eventos, despliegue y guion
  .github/workflows/      # CI y deploy
```

## Decisiones y límites conocidos

- GameStats deduplica `eventId` de forma global; un `422` de duplicado se trata como evento ya entregado.
- El `202` de GameStats confirma recepción, no aceptación lógica. Por eso el `MATCH_STARTED` se espera antes de continuar.
- GameStats guarda partidas en memoria: al reiniciar el servicio Go, `/analysis` de partidas viejas deja de existir y el panel lo muestra como no disponible.
- `connect4` recibe el análisis genérico de GameStats (`eventsCount`, `playersCount`, `note`), porque Scala no tiene analizador específico para ese juego.
- El registro de partidas usa una clave de `localStorage` por partida y se fusiona con `gameconsole.matches.v1`; así dos pestañas no se sobrescriben al crear partidas a la vez. El Lobby sigue mostrando solo las sesiones de la pestaña actual.
- La IA usa profundidad configurable (3–6, por defecto 4). Más profundidad aumenta el tiempo de respuesta; el cliente corta a los 15 s y permite reintentar.
