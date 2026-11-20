# Despliegue

## Requisitos

- Docker Engine 24+ con Compose v2.
- Repositorios hermanos:

  ```
  Lenguajes-Programacion/
    GameStats/
    GameConsole/
  ```

GameStats debe estar en la rama `feature/gameconsole-integration` mientras no se integre en `main`. El compose de GameConsole construye GameStats desde `../GameStats/scala-service` y `../GameStats/go-service`.

## GameStats y separación de repositorios

GameStats es un repositorio independiente y no se copia dentro de GameConsole. GameConsole no modifica su código.

- El stack local construye las imágenes de Go y Scala desde `../GameStats`; hoy no se publican en un registry.
- CI y CD fijan la rama con `GAMESTATS_REF=feature/gameconsole-integration`; si esa rama se integra en `main`, hay que actualizar la referencia.
- El estado de las partidas vive en memoria del servicio Go. Reiniciar el proceso pierde partidas y análisis; no hay persistencia externa.
- Cualquier despliegue con réplicas o reinicios frecuentes debe resolver esa limitación antes de considerarse equivalente al stack local. No está implementado.

## Local / VM

```bash
cd GameConsole
cp .env.example .env       # opcional: WEB_PORT, PROLOG_PORT
docker compose up -d --build --wait
docker compose ps
```

Windows PowerShell:

```powershell
Set-Location "C:\ruta\a\Lenguajes-Programacion\GameConsole"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose down --remove-orphans
docker compose up -d --build --wait
docker compose ps
```

- Consola: `http://localhost:8088` (o `WEB_PORT`).
- GameStats y Prolog quedan en la red interna de Compose; Prolog además se publica en `127.0.0.1:8090` para depuración y para el modo desarrollo con Vite.

Verificación:

```powershell
$web = Invoke-WebRequest -Uri "http://localhost:8088/healthz" -UseBasicParsing
$api = Invoke-RestMethod -Uri "http://localhost:8088/api/health"
$prolog = Invoke-RestMethod -Uri "http://localhost:8088/prolog/health"
[pscustomobject]@{ Web = $web.StatusCode; GameStats = $api.status; Prolog = $prolog.status } | Format-List

node scripts/smoke.mjs
```

El script comprueba salud de GameStats y Prolog, envía un partido de Conecta 4 completo por el proxy, espera el análisis y valida `byGame.connect4`.

Pruebas del proyecto:

```powershell
Set-Location web
npm ci
npm test
npm run lint
npm run build

Set-Location ..
docker run --rm -v "${PWD}\prolog:/app" -w /app swipl:9.2.9 `
  swipl -q -g run_tests -t halt tests.pl
```

## Actualizar

```bash
git pull --ff-only
docker compose up -d --build
```

Si se modificó el código de GameStats, el `--build` reconstruye también sus imágenes. El estado de GameStats es en memoria: al recrear `gamestats-go` se pierden las partidas anteriores.

## Puertos

| Servicio | Interno | Host |
| --- | --- | --- |
| web (nginx) | 80 | `${WEB_PORT:-8088}` |
| gamestats-go | 8080 | no publicado |
| gamestats-scala | 8081 | no publicado |
| prolog | 8090 | `127.0.0.1:${PROLOG_PORT:-8090}` |

En una VM, abrir solo el puerto de `web` (por defecto 8088; se puede mapear `80:80` con `WEB_PORT=80`).

## CI

`.github/workflows/ci.yml` ejecuta en cada push/PR:

1. `npm ci`, `npm test` y `npm run build` en `web/`.
2. Pruebas `plunit` de Prolog en `swipl:9.2.9`.
3. Job `integration`: clona GameStats, valida `docker compose`, construye las cuatro imágenes, levanta el stack con healthchecks, ejecuta `scripts/smoke.mjs` y lo detiene.

La rama integrada de GameStats está fijada en `ci.yml`:

```yaml
env:
  GAMESTATS_REPOSITORY: https://github.com/Kenneth-11/gamestats.git
  GAMESTATS_REF: feature/gameconsole-integration
```

Si esa rama se integra en `main`, actualizar `GAMESTATS_REF` para no depender de una rama de integración.

## CD actual (VM por SSH)

`.github/workflows/deploy.yml` se lanza manualmente (`workflow_dispatch`). Secretos requeridos:

| Secreto | Contenido |
| --- | --- |
| `DEPLOY_HOST` | IP o dominio de la VM |
| `DEPLOY_USER` | usuario SSH |
| `DEPLOY_SSH_KEY` | clave privada SSH |
| `DEPLOY_PATH` | ruta al repo GameConsole en la VM |

El job:

1. Hace `git pull --ff-only` en GameConsole, salvo `skip_pull=true`.
2. Actualiza el repo hermano `../GameStats` a `GAMESTATS_REF`, o lo clona si no existe.
3. Valida el Compose, reconstruye y levanta el stack esperando healthchecks.

La VM debe tener los repositorios hermanos:

```
DEPLOY_PATH/
  GameConsole/
  GameStats/
```

Alternativa local en la VM:

```bash
./scripts/deploy.sh
SKIP_GIT_PULL=1 ./scripts/deploy.sh
```

`GAMESTATS_REF` se puede cambiar sin editar el script:

```bash
GAMESTATS_REF=main ./scripts/deploy.sh
```

## Azure Container Apps (despliegue preview)

Estado: **desplegado y verificado**. URL pública de GameConsole:
`https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`

Entorno definido por el equipo:

- Suscripción `Azure for Students`, resource group existente `gameconsole-rg`, región `francecentral`.
- Un Container Apps Environment `gameconsole-aca-env` y un workspace de Log Analytics `gameconsole-logs` (30 días de retención). No se crearon VM ni ACR.
- Cuatro Container Apps con imágenes publicadas en `ghcr.io/kenneth-11` con tag `aca-preview-1`. La imagen web quedó fijada por digest para forzar el pull de la corrección de HTTPS.
- Recursos por app: `gamestats-scala` 0.5 vCPU/1.0Gi (1/1), `gamestats-go` 0.25/0.5Gi (1/1), `gameconsole-prolog` 0.25/0.5Gi (0/3) y `gameconsole-web` 0.25/0.5Gi (1/3). Sin aumentos respecto al diseño aprobado.
- Ingress: inicialmente `web` external y los tres backends internal. El environment Express no resuelve nombres cortos y el certificado del ingress interno no permite validación de hostname, por lo que los tres backends se cambiaron a `external` de forma temporal, con HTTPS + SNI + validación de certificados y reglas de IP que solo permiten el egress de `gameconsole-web` y `gamestats-go`. Ver [deploy/aca/README.md](../deploy/aca/README.md#13-exposicion-temporal-de-backends-evaluacion-en-azure) para el cierre de esa exposición.

Scripting y verificación:

- `deploy/aca/*.ps1`: construcción de imágenes, publicación en GHCR, preflight, deploy, smoke, verificación de reproducibilidad y rollback. Los secretos se leen de `GHCR_USERNAME`/`GHCR_PAT` y se redactan en la salida; no hay credenciales en el repositorio.
- Pruebas ejecutadas contra la URL pública: `/healthz`, `/api/health` y `/prolog/health` → 200; tres pruebas `live.test.ts` (racing, combat, connect4) → PASS; `scripts/smoke.mjs` → PASS con decisión real de Prolog, análisis de GameStats y actualización de `byGame.connect4`.

Limitación: `gamestats-go` mantiene las partidas en memoria; un reinicio o redeploy pierde el estado, igual que en el stack local. El despliegue es una versión funcional de evaluación, no una configuración de producción con persistencia.

## Diagnóstico

| Síntoma | Causa / solución |
| --- | --- |
| `502` en `/api` | GameStats aún no está healthy; revisar `docker compose ps` y logs de `gamestats-go` |
| `502` en `/prolog` | Prolog aún arranca; revisar `docker compose logs prolog` |
| El panel muestra análisis “no disponible” | GameStats se reinició y perdió el estado en memoria |
| Partida con error de GameStats | Revisar la respuesta en el log de eventos; un `400` detiene la cola |
| IA lenta | Reducir profundidad a 3–4 en el lobby |
| Puerto ocupado | Cambiar `WEB_PORT` o `PROLOG_PORT` en `.env` |
