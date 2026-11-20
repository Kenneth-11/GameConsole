# Azure Container Apps - despliegue de GameConsole

Estado: **despliegue preview ejecutado y verificado**. URL publica: `https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`. No se crearon VM ni ACR; los recursos estan en `gameconsole-rg` / `francecentral`.

## 1. Arquitectura desplegada

- Suscripcion: `Azure for Students` (`4d617f88-c16b-4c91-8cce-52c8c0863e33`)
- Region: `francecentral` (unica permitida junto con otras cuatro por la politica `sys.regionrestriction`)
- Resource group existente: `gameconsole-rg` (reutilizar, no crear)
- Un unico Container Apps Environment: `gameconsole-aca-env`
- Workspace de Log Analytics: `gameconsole-logs`, retencion 30 dias
- Registro: `ghcr.io/kenneth-11`, sin ACR

| App | Ingress | Target port | vCPU / RAM | Min / Max | FQDN |
|---|---|---|---:|---:|---|
| `gamestats-scala` | external (temporal) | 8081 | 0.5 / 1.0Gi | 1 / 1 | `gamestats-scala.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io` |
| `gameconsole-prolog` | external (temporal) | 8090 | 0.25 / 0.5Gi | 0 / 3 | `gameconsole-prolog.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io` |
| `gamestats-go` | external (temporal) | 8080 | 0.25 / 0.5Gi | 1 / 1 | `gamestats-go.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io` |
| `gameconsole-web` | external | 80 | 0.25 / 0.5Gi | 1 / 3 | `gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io` |

Los tres backends se crearon con ingress `internal` y se cambiaron a `external` de forma temporal para resolver la comunicacion HTTPS en Express; el detalle y como cerrar esa exposicion estan en la seccion 13. Orden de creacion: workspace, environment, scala, prolog, go, web.

## 2. Comunicacion interna

En ACA los backends se alcanzan por FQDN sobre HTTPS. Nginx usa `proxy_pass https://${...}/`, `proxy_ssl_server_name on`, `proxy_ssl_verify on` y el bundle de CA del sistema; las variables `*_TLS_NAME` fijan el nombre verificado del certificado.

| Origen | Destino | Valor configurado |
|---|---|---|
| `gameconsole-web` (nginx) | Go | `GAMESTATS_GO_HOST=gamestats-go.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`, `GAMESTATS_GO_TLS_NAME=` el mismo FQDN |
| `gameconsole-web` (nginx) | Prolog | `GAMECONSOLE_PROLOG_HOST=gameconsole-prolog.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`, `GAMECONSOLE_PROLOG_TLS_NAME=` el mismo FQDN |
| `gamestats-go` | Scala | `SCALA_SERVICE_URL=https://gamestats-scala.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io` |
| Prolog / Scala | — | sin variables de red |

En Local las pruebas usan `gamestats-go:8080`, `gameconsole-prolog:8090` y `http://gamestats-scala:8081` porque no existe el proxy de ACA. El codigo funcional no se modifico: el archivo `web/nginx.conf` original permanece intacto; se usa una plantilla de despliegue en `deploy/aca/nginx.conf.template`.

## 3. Archivos creados

| Archivo | Uso |
|---|---|
| `deploy/aca/config.ps1` | Unica fuente de nombres,region,tamanos,tags y rutas |
| `deploy/aca/nginx.conf.template` | Nginx con variables para ACA y para prueba local |
| `deploy/aca/web.Dockerfile` | Imagen web con la plantilla anterior |
| `deploy/aca/web.Dockerfile.dockerignore` | Excluye `node_modules`, `dist` y `.git` del contexto |
| `deploy/aca/build-images.ps1` | Construye las cuatro imagenes localmente |
| `deploy/aca/push-ghcr.ps1` | Publica en GHCR; requiere `-Execute` (ejecutado) |
| `deploy/aca/deploy.ps1` | Preflight + plan; requiere `-Execute` para crear recursos (ejecutado) |
| `deploy/aca/smoke.ps1` | Health checks y smoke test contra un FQDN/URL |
| `deploy/aca/test-local.ps1` | Levanta las cuatro imagenes en Docker y corre smoke |
| `deploy/aca/apps/*.yaml` | Manifiestos de ACA con probes de startup, liveness y readiness |
| `deploy/aca/verify-reproducibility.ps1` | Comprueba commit, archivos, imagenes y preflight sin crear recursos |
| `deploy/aca/rollback.ps1` | Rollback por revisiones o teardown completo; requiere `-Execute` |

No se modifico `GameConsole/web/nginx.conf` ni ningun archivo funcional. GameStats se usa exactamente en `da412e6` (HEAD local verificado, arbol limpio).

## 4. Construccion local de imagenes

```powershell
cd GameConsole
./deploy/aca/build-images.ps1
```

Verifica que `GameStats` este en `da412e6` y limpio; si no, falla. Construye:

- `gameconsole-web:aca-preview-1`
- `gamestats-go:aca-preview-1`
- `gamestats-scala:aca-preview-1`
- `gameconsole-prolog:aca-preview-1`

El tag por defecto se define en `config.ps1` (`aca-preview-1`); se puede override con `-ImageTag`.

## 5. Publicacion en GHCR (ejecutado)

Requiere un PAT clasico con `read:packages` para ACA y `write:packages` para publicar.

```powershell
$env:GHCR_USERNAME = 'kenneth-11'
$env:GHCR_PAT = '<PAT>'
cd GameConsole
./deploy/aca/push-ghcr.ps1            # solo imprime el plan
./deploy/aca/push-ghcr.ps1 -Execute   # publica
```

ACA exige configurar el registro **incluso si la imagen es publica**. El PAT se guarda como secreto de la app; `GITHUB_TOKEN` solo sirve para publicar desde Actions, no para los pulls posteriores de ACA.

## 6. Despliegue en Azure (ejecutado)

```powershell
$env:GHCR_USERNAME = 'kenneth-11'
$env:GHCR_PAT = '<PAT con read:packages>'
cd GameConsole
./deploy/aca/deploy.ps1 -PreflightOnly   # solo lectura
./deploy/aca/deploy.ps1                  # imprime el plan completo
./deploy/aca/deploy.ps1 -Execute         # crea los recursos
./deploy/aca/smoke.ps1 -BaseUrl 'https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io'
```

URL publica verificada: `https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io`. Las cuatro apps quedaron `Healthy` y las pruebas de integracion pasaron.

Comandos exactos que crean recursos (equivalentes a `-Execute`):

```bash
az monitor log-analytics workspace create -g gameconsole-rg -n gameconsole-logs -l francecentral --retention-time 30 -o json
az monitor log-analytics workspace get-shared-keys -g gameconsole-rg -n gameconsole-logs --query primarySharedKey -o tsv
az containerapp env create -n gameconsole-aca-env -g gameconsole-rg -l francecentral \
  --logs-destination log-analytics --logs-workspace-id <customer-id> --logs-workspace-key <key>

Los manifiestos `apps/<app>.yaml` contienen ingress, CPU/RAM, escalado, variables, credenciales de GHCR y probes de `Startup`, `Liveness` y `Readiness`. `deploy.ps1 -Execute` reemplaza los placeholders `__IMAGE__`, `__GHCR_USERNAME__`, `__GHCR_PAT__` y `__ENVIRONMENT_ID__` en un archivo temporal con ACL restringida al usuario actual, ejecuta `az` y lo elimina.

```bash
az containerapp create -n gamestats-scala -g gameconsole-rg --yaml <secure-temp-manifest>
az containerapp create -n gameconsole-prolog -g gameconsole-rg --yaml <secure-temp-manifest>
az containerapp create -n gamestats-go -g gameconsole-rg --yaml <secure-temp-manifest>
az containerapp create -n gameconsole-web -g gameconsole-rg --yaml <secure-temp-manifest>
```

`<secure-temp-manifest>` se genera en `$env:TEMP`, no se guarda en el repositorio y se borra en un bloque `finally`.

## 7. Secretos

- No hay secretos en archivos del repositorio. Los manifiestos usan el placeholder `__GHCR_PAT__`. `deploy.ps1` y `push-ghcr.ps1` leen `GHCR_USERNAME` y `GHCR_PAT` del entorno y redactan el valor en el plan.
- `deploy.ps1 -Execute` materializa el manifiesto en `$env:TEMP` con ACL restringida al usuario actual, lo pasa a `az containerapp create --yaml` y lo elimina en `finally`.
- Ingreso del PAT: `docker login ghcr.io -u <user> --password-stdin` evita exponerlo en la linea de comandos de Docker.
- ACA guarda el valor cifrado como secreto de la app; no se puede recuperar en claro. Rotar el PAT implica actualizar el secreto de las cuatro apps con `az containerapp secret set` / `az containerapp registry set`.
- Permiso minimo: `read:packages` para ACA; `write:packages` solo para la maquina/CI que publica.
- No usar `latest`: las imagenes se fijan por tag de despliegue.

## 8. Pruebas de salud y smoke

Local (sin Azure):

```powershell
cd GameConsole
./deploy/aca/test-local.ps1
```

Verifica `/healthz`, `/api/health`, `/prolog/health` y ejecuta `scripts/smoke.mjs` (partida de Conecta 4 completa, analisis de Scala y `byGame.connect4`).

Health probes configurados en los manifiestos YAML (tipo HTTP, uno de cada tipo por contenedor):

| App | Startup | Liveness | Readiness |
|---|---|---|---|
| `gamestats-scala` | `/health:8081`, delay 10s, periodo 5s, umbral 30 | `/health:8081`, delay 20s, periodo 15s | `/health:8081`, delay 10s, periodo 10s |
| `gamestats-go` | `/health:8080`, delay 5s, periodo 5s, umbral 12 | `/health:8080`, delay 10s, periodo 15s | `/health:8080`, delay 5s, periodo 10s |
| `gameconsole-prolog` | `/health:8090`, delay 5s, periodo 5s, umbral 12 | `/health:8090`, delay 10s, periodo 15s | `/health:8090`, delay 5s, periodo 10s |
| `gameconsole-web` | `/healthz:80`, delay 3s, periodo 5s, umbral 12 | `/healthz:80`, delay 10s, periodo 15s | `/healthz:80`, delay 5s, periodo 10s |

El umbral amplio de Scala cubre el arranque de JVM/sbt fat-jar sin reinicios prematuros.

En Azure:

```powershell
./deploy/aca/smoke.ps1 -BaseUrl 'https://gameconsole-web.kindgrass-c6ff1ed0.francecentral.azurecontainerapps.io'
```

## 9. Costo estimado (USD, francecentral)

Tarifas ACA Consumption: vCPU activo `$0.000024/s`, vCPU inactivo `$0.000003/s`, memoria `$0.000003/GiB-s`, requests `$0.40/M`. Free grant mensual por suscripcion: 180,000 vCPU-s, 360,000 GiB-s y 2M requests. Llamadas entre apps del mismo Environment no se facturan como requests; health probes tampoco.

| Escenario | Configuracion | Costo mensual estimado |
|---|---|---:|
| Ahorro maximo | todas las apps `min=0` | `$0` en reposo; uso probablemente dentro del free grant |
| Propuesto | web, go y scala `min=1`; prolog `min=0` | ~`$23.65` lista / ~`$22` despues del free grant |
| Todo siempre activo | cuatro apps `min=1` | ~`$29.55` lista / ~`$28` tras free grant |

Otros conceptos:

| Concepto | Costo |
|---|---|
| Environment Consumption | `$0` fijo |
| Log Analytics | `$0` hasta 5 GB/mes de ingesta; 30 dias de retencion incluidos |
| GHCR (paquetes publicos) | `$0`; almacenamiento/banda de contenedores actualmente gratis |
| ACR (no usado) | Basic ~`$5/mes`, Standard ~`$20/mes` |

El credito de $100 cubre el escenario propuesto durante aproximadamente 4 meses.

Para evitar gasto innecesario: `min=0` en prolog, `max` bajo, un solo Environment, sin ACR/VNet/dominio propio, retencion 30 dias, revision mode `Single`, y bajar a `min=0` las apps cuando no se usen:

```bash
az containerapp update -n gameconsole-web -g gameconsole-rg --min-replicas 0
```

## 10. Datos y reinicios

- `gamestats-go` mantiene partidas, eventos, dedupe y analisis **en memoria**. Un reinicio, redeploy o escalado a cero borra todo.
- `gamestats-scala` y `gameconsole-prolog` son stateless; `gameconsole-web` sirve archivos estaticos.
- El registro de partidas de la consola vive en `localStorage` del navegador y no depende del contenedor.
- Mitigacion aplicada: `gamestats-go` con `min=max=1` y `Single` revision mode evita multiples copias con estado divergente y evita el scale-to-zero. No evita la perdida ante mantenimiento de plataforma o redeploy.
- Persistencia real requeriria almacenamiento externo (Redis/Base de datos/Azure Files) y cambios en GameStats; esta fuera de esta etapa.

## 11. Riesgos y limitaciones pendientes

1. La cuota de Managed Environment es `1` por region en esta suscripcion; el diseno usa exactamente uno.
2. Puede existir un tope global no visible por CLI en suscripciones patrocinadas; no bloquea un solo environment.
3. El nombre corto de app internos es la forma recomendada, pero existen reportes de fallos intermitentes del sidecar; si aparecen, usar el FQDN `.internal...azurecontainerapps.io` en las variables de entorno.
4. GameStats pierde estado ante reinicios; limitacion conocida y aceptada.
5. El PAT de GHCR requiere rotacion; si expira, las apps no pueden descargar imagenes en nuevos revisions.
6. Los health probes ya estan definidos en `apps/*.yaml`, pero su comportamiento real solo se validara cuando ACA cree los recursos; la sintaxis YAML se valido localmente con `yq`.
7. `spendingLimit: On`: al agotar $100 la suscripcion se deshabilita; no hay sobrecargo, pero el servicio se detiene.

## 12. Rollback

Rollback no destructivo por revisiones (modo `Single`): desactiva la revision activa y activa la revision anterior de las cuatro apps.

```powershell
cd GameConsole
./deploy/aca/rollback.ps1                 # plana, sin cambios
./deploy/aca/rollback.ps1 -Execute        # aplica rollback
./deploy/aca/rollback.ps1 -Revision <revision> -Execute
```

Teardown completo (destructivo, requiere doble confirmacion):

```powershell
./deploy/aca/rollback.ps1 -DeleteResources -Force        # plana
./deploy/aca/rollback.ps1 -DeleteResources -Force -Execute
```

Orden de borrado: `gameconsole-web`, `gamestats-go`, `gameconsole-prolog`, `gamestats-scala`, environment y workspace.

Nota: el rollback de `gamestats-go` a una revision anterior no recupera partidas en memoria; la nueva revision arranca con estado vacio. Para evitar este riesgo se usa `min=max=1` y `Single` revision mode.

## 13. Exposicion temporal de backends (evaluacion en Azure)

Durante la puesta en marcha se cambio el ingress de `gamestats-scala`, `gamestats-go` y `gameconsole-prolog` de `internal` a `external`. Motivo: el environment es Express (sin service discovery por nombre corto) y el ingress interno presenta un certificado `proxy.francecentral.azuredevcompute.io` que no permite validacion de hostname, por lo que Nginx no puede hacer HTTPS con `proxy_ssl_verify on` contra esos backends.

Proteccion aplicada: reglas de IP `Allow` en los tres backends para las IPs de salida observadas (`20.188.63.111/32` de `gameconsole-web` y `20.19.183.66/32` de `gamestats-go`). Todo el demas trafico queda denegado. Las imagenes usan HTTPS con SNI y validacion de certificado; no se desactivo `proxy_ssl_verify`.

Para cerrar la exposicion al terminar la evaluacion, en cada backend:

```powershell
az containerapp ingress access-restriction remove -n gamestats-go -g gameconsole-rg --rule-name allow-web-egress
az containerapp ingress access-restriction remove -n gamestats-go -g gameconsole-rg --rule-name allow-go-egress
az containerapp ingress update -n gamestats-go -g gameconsole-rg --type internal
```

Repetir para `gameconsole-prolog` y `gamestats-scala`. Al volver a `internal`, restaurar las variables `GAMESTATS_GO_HOST`, `GAMECONSOLE_PROLOG_HOST`, `GAMESTATS_GO_TLS_NAME` y `GAMECONSOLE_PROLOG_TLS_NAME` de `gameconsole-web`, y `SCALA_SERVICE_URL` de `gamestats-go`, a sus FQDN `.internal.` originales. Las IPs de salida pueden cambiar: verificarlas con `wget -q -O - https://api.ipify.org` desde cada app antes de reaplicar restricciones.
