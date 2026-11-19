# Despliegue

## Requisitos

- Docker Engine 24+ con Compose v2.
- Repositorios hermanos:

  ```
  Lenguajes-Programacion/
    GameStats/
    GameConsole/
  ```

El compose de GameConsole construye GameStats desde `../GameStats/scala-service` y `../GameStats/go-service`.

## Local / VM

```bash
cd GameConsole
cp .env.example .env       # opcional: WEB_PORT, PROLOG_PORT
docker compose up -d --build
docker compose ps
```

- Consola: `http://localhost:8088` (o `WEB_PORT`).
- GameStats y Prolog quedan en la red interna de Compose.
- Prolog se expone en `127.0.0.1:8090` para depuración y para el modo desarrollo con Vite.

Verificación:

```bash
node scripts/smoke.mjs
```

El script comprueba salud de GameStats y Prolog, envía un partido de Conecta 4 completo por el proxy, espera el análisis y valida `byGame.connect4`.

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

Si esa rama se integra en `main`, actualizar `GAMESTATS_REF` para no depender de una rama temporal.

## CD

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

## Diagnóstico

| Síntoma | Causa / solución |
| --- | --- |
| `502` en `/api` | GameStats aún no está healthy; revisar `docker compose ps` y logs de `gamestats-go` |
| `502` en `/prolog` | Prolog aún arranca; revisar `docker compose logs prolog` |
| El panel muestra análisis “no disponible” | GameStats se reinició y perdió el estado en memoria |
| Partida con error de GameStats | Revisar la respuesta en el log de eventos; un `400` detiene la cola |
| IA lenta | Reducir profundidad a 3–4 en el lobby |
| Puerto ocupado | Cambiar `WEB_PORT` o `PROLOG_PORT` en `.env` |
