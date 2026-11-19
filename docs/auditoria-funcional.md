# Auditoría funcional de GameConsole

- Fecha: 2026-11-18
- Repositorio: `https://github.com/Kenneth-11/GameConsole.git`
- Commit verificado: `b714b672389e3c28916f96f3bdaf4dbecb6ad554`
- Entorno: Windows, Docker Desktop, Docker Compose v5.7.0, Microsoft Edge headless
- Stack: GameConsole + GameStats Go/Scala + SWI-Prolog, servido en `http://localhost:8088`
- Alcance: verificación funcional de los 10 requisitos acordados. No se agregó funcionalidad ni se modificó GameStats durante esta auditoría.
- Estado de GameStats: rama `feature/gameconsole-integration`, commit `da412e6`, árbol limpio. `main` permanece en `247a055`.
- El informe queda como archivo local, sin commit ni push.

## Resumen ejecutivo

| Estado | Cantidad | Requisitos |
| --- | ---: | --- |
| Cumplidos | 9 | 1, 2, 3, 4, 5, 6, 7, 8 y 9 |
| Parciales | 1 | 10 |
| Pendientes | 0 | Ninguno del alcance funcional |

La aplicación crea y termina los tres juegos, mantiene separadas las partidas simultáneas, envía eventos válidos y en orden, GameStats los procesa y analiza, y el panel muestra datos reales. La única verificación incompleta es el despliegue CD real en una VM: el CI sí se ejecutó con éxito, pero el workflow de despliegue no se lanzó porque requiere secrets y un host SSH.

## Requisitos cumplidos

### 1. Crear y jugar los tres juegos de principio a fin

Cumplido. En una sola corrida E2E se jugaron los tres juegos hasta `finalizada`:

| Juego | Partida | Eventos | Resultado | Análisis |
| --- | --- | ---: | --- | --- |
| Carrera | `gc-racing-5ceacc02-62c6-4524-92ed-6dac7424b2d0` | 11 | Ganó el humano | `analyzed`, 3 vueltas, 2 jugadores |
| Combate | `gc-combat-7ba75a64-7282-4adf-8346-637b4c0414d2` | 19 | Ganó el humano | `analyzed`, 14 ataques, 191 de daño |
| Conecta 4 | `gc-connect4-baa71052-caa8-4fd1-aca8-2246f8c34250` | 28 | Ganó la IA de Prolog | `analyzed`, estructura genérica válida |

No hubo errores de consola ni fallos de red en el navegador.

### 2. Conecta 4 contra la IA en Prolog

Cumplido. La partida generó 8 eventos `AI_DECISION` y realizó 8 llamadas reales a `POST /prolog/decide`. Las 8 respondieron `200`, con profundidad 4, columnas legales y valores de `nodes`/`score` coherentes con la decisión aplicada.

Pruebas directas adicionales del endpoint, con 5 repeticiones por escenario, fueron deterministas:

| Escenario | Respuesta |
| --- | --- |
| Tablero vacío | columna 4, 380 nodos, respuestas idénticas |
| Victoria inmediata | columna 4, 193 nodos, score `100004` |
| Bloqueo obligatorio | columna 4, 260 nodos, score negativo |
| Victoria lateral | columna 2, 408 nodos, score `100004` |

Las pruebas plunit pasaron 11/11: tablero, caída, victoria horizontal/vertical/diagonal, ausencia de victoria, movimiento legal, victoria de la IA, bloqueo y tablero lleno.

### 3. Varias partidas simultáneas en diferentes pestañas

Cumplido. Tres pestañas jugaron carrera, combate y Conecta 4 al mismo tiempo. Cada juego conservó su propio `matchId` y su propio contador de envío:

- Carrera: `11/11`
- Combate: `19/19`
- Conecta 4: `28/28`

GameStats recibió 3 partidas y 58 eventos en total, sin errores de mezcla.

### 4. Los eventos no se mezclan entre partidas

Cumplido. Se verificó:

- 58 eventos enviados, 58 `eventId` distintos.
- 3 `matchId` distintos, uno por juego.
- Todos los eventos de cada pestaña conservaron su `matchId`.
- El primer evento de cada partida fue `MATCH_STARTED`.
- Ningún evento se envió después de `MATCH_FINISHED`.
- El orden de la cola y los timestamps fueron monotónicos.
- GameStats no registró eventos rechazados: `processed=58`, `rejectedEvents=0`.

### 5. Contrato de eventos con GameStats

Cumplido. Los 58 eventos obtuvieron HTTP `202`. Se verificaron `eventId` UUID únicos, `matchId` con formato `gc-<gameId>-<uuid>`, `gameId` correcto, timestamps ISO UTC con milisegundos y `MATCH_STARTED` antes del resto de la cola.

La cola FIFO por partida funcionó con paralelismo entre partidas. No se observaron envíos posteriores al cierre ni duplicados en esta corrida.

### 6. GameStats recibe, procesa y analiza los eventos

Cumplido para la ingesta y el análisis consultado por la consola:

| Juego | Partidas | Finalizadas | Analizadas | Activas | Eventos | Jugadores |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| racing | 1 | 1 | 1 | 0 | 11 | 2 |
| combat | 1 | 1 | 1 | 0 | 19 | 2 |
| connect4 | 1 | 1 | 1 | 0 | 28 | 2 |

Totales: 3 partidas, 58 eventos, 58 procesados, 0 rechazados, 3 jugadores únicos. Las tres consultas `/analysis` respondieron `200` con estado `analyzed`.

Limitaciones conocidas de GameStats, no bloqueantes para el panel:

- Conecta 4 no tiene análisis especializado; recibe el análisis genérico con `eventsCount`, `playersCount` y `note`.
- La fuente correcta para estadísticas es `/analysis`. Los endpoints crudos `GET /matches/{id}` y `GET /players/{id}/stats` no reflejan el daño de combate (ver Hallazgos).

### 7. El panel consulta estadísticas reales

Cumplido. El panel mostró exactamente los valores de `GET /api/stats`:

- Tarjetas: `3` partidas, `3` jugadores, `58` eventos, `58 / 0` procesados/rechazados.
- Tabla por juego: los tres juegos con `1` partida, `1` finalizada, `0` activas, `1` analizada, eventos `11/19/28` y `2` jugadores cada uno.
- Las tres filas de partidas mostraron su estado de análisis.
- En una prueba adicional con una partida activa, el panel de otra pestaña mostró `racing: 1 partida, 0 finalizadas, 1 activa, 0 analizadas, 3 eventos, 2 jugadores`.

El panel no renderiza todas las métricas detalladas del análisis; muestra estado y patrones, y ofrece el JSON completo. Esto cumple la consulta de estadísticas reales, pero es una limitación de presentación si se esperaba ver el detalle dentro de la interfaz.

### 8. Registro de partidas activas entre pestañas

Cumplido para el registro y el panel, con una limitación de interfaz:

- `localStorage` usa la clave compartida `gameconsole.matches.v1`.
- Al crear una partida activa en la pestaña A, la pestaña B vio esa partida en su registro y en el panel como `racing: 1 activa`.
- Tras terminar las tres partidas, el panel de B listó las 3 y el registro compartido contuvo los 3 `matchId`.
- Tras recargar B, el registro siguió conteniendo las 3 partidas.

Limitación: el Lobby muestra únicamente `Partidas abiertas en esta pestaña`; no lista sesiones de otras pestañas, no se actualiza en vivo y no permite reanudar una partida después de recargar. Los datos sí se comparten y el panel los muestra. Si el requisito exige reabrir partidas activas de otra pestaña, quedaría parcialmente cubierto y requeriría estado compartido o un backend de sesiones.

### 9. Docker Compose levanta todo correctamente

Cumplido. Se ejecutó un ciclo limpio:

```bash
docker compose down --remove-orphans
docker compose up -d --build
docker compose ps
```

Resultado: `web`, `gamestats-go` y `gamestats-scala` quedaron `healthy`; `prolog` quedó arriba y respondió en `127.0.0.1:8090`. El frontend respondió en `http://localhost:8088`, y Nginx enrutó `/api` y `/prolog` correctamente. `docker compose config --quiet` terminó con código 0.

## Requisitos parcialmente cumplidos

### 10. CI/CD ejecuta correctamente las comprobaciones configuradas

Parcial. El CI real se ejecutó en GitHub Actions y pasó:

- Run: `44403832285` (`CI`), evento `push`, conclusión `success`.
- URL: `https://github.com/Kenneth-11/GameConsole/actions/runs/44403832285`
- Jobs: `web` ✅, `prolog` ✅, `images` ✅.
- El job `web` ejecutó `npm ci`, `npm test` y `npm run build`.
- El job `prolog` ejecutó las pruebas plunit.
- El job `images` construyó las imágenes web y Prolog.

También se verificaron localmente `npm test` (14 aprobadas, 3 live omitidas), `npm run lint`, `npm run build`, plunit 11/11, `go test ./...`, `go vet ./...`, `docker compose config` y la sintaxis de `scripts/deploy.sh`.

No se ejecutó el workflow `Deploy` en una VM real: es manual y requiere `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` y `DEPLOY_PATH`. Por eso no se puede afirmar que el despliegue CD funcione de extremo a extremo. Además, el CI no ejecuta E2E de partidas completas ni construye las imágenes de GameStats; esas comprobaciones se hicieron localmente con Compose.

## Requisitos pendientes

No quedó ningún requisito funcional sin implementar. Queda pendiente de verificación real el despliegue CD en la VM y, como fortalecimiento, incorporar la prueba E2E de los tres juegos al CI.

## Errores y hallazgos

No se encontraron errores bloqueantes en los 10 requisitos.

### Hallazgo 1: estadísticas crudas de combate en Go

`GET /api/matches/gc-combat-7ba75a64-7282-4adf-8346-637b4c0414d2` devolvió:

```json
{
  "combat": {
    "averageDamage": 0,
    "timesEliminated": 0,
    "totalAttacks": 0,
    "totalDamage": 0,
    "totalEliminations": 0
  },
  "eventsCount": 19
}
```

El mismo combate en `/analysis` reportó 14 ataques, 191 de daño y 1 eliminación. `GET /players/p-human/stats` también mostró `damageInflicted: 0` y `averageDamage: 0`, mientras que el análisis Scala era correcto.

Causa observada: GameConsole envía `PLAYER_ATTACKED` y `PLAYER_ELIMINATED` con `playerId: ""`; el agregador crudo de Go usa ese campo, mientras que Scala usa `data.attacker`. El contrato de GameStats permite `playerId` opcional, por lo que no hay rechazo. Es una discrepancia semántica conocida de GameStats, ya documentada en la verificación P0. No afecta al panel actual porque consume `/analysis`, pero afecta a consumidores de `/matches/{id}` o `/players/{id}/stats`.

### Hallazgo 2: Lobby local, no colaborativo

El registro se comparte, pero el Lobby solo muestra las sesiones de la pestaña actual. No hay evento `storage` para refrescar la lista ni forma de reabrir una partida de otra pestaña. Si se desea una experiencia de sesiones compartidas, hace falta un estado de sesión compartido; `localStorage` por sí solo no puede reanudar objetos de juego en memoria.

### Hallazgo 3: análisis genérico de Conecta 4

GameStats no tiene analizador específico para `connect4`; el panel muestra el análisis genérico y `patterns` nulo. Es una limitación conocida, no un fallo de integración.

### Hallazgo 4: cobertura E2E fuera del repositorio

La corrida de los tres juegos completos se hizo con un harness Playwright temporal, no versionado. El CI valida unit tests, build, plunit e imágenes, pero no detectaría una regresión de juego completo. Se recomienda incorporar el E2E al repositorio y al pipeline.

## Evidencias de pruebas

### Corrida E2E final

- Fecha de la corrida: `2026-11-18T21:49:30Z` a `2026-11-18T21:50:00Z`.
- Commit auditado: `b714b672389e3c28916f96f3bdaf4dbecb6ad554`.
- 3 pestañas, 3 juegos, 58 eventos, 3 `matchId`.
- 58 `eventId` únicos; 58 respuestas `202`; 0 rechazados.
- 8 decisiones de IA y 8 llamadas Prolog.
- 0 errores de consola; 0 fallos de red.
- Fallos del harness: 0.

Llamadas Prolog de la partida:

| Orden | Columna | Nodos | Score | HTTP |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 586 | -37 | 200 |
| 2 | 4 | 1070 | -46 | 200 |
| 3 | 3 | 858 | -30 | 200 |
| 4 | 5 | 1011 | -29 | 200 |
| 5 | 3 | 364 | 58 | 200 |
| 6 | 5 | 698 | 104 | 200 |
| 7 | 5 | 535 | 147 | 200 |
| 8 | 5 | 67 | 100004 | 200 |

### Panel final

```text
Partidas                 3
Jugadores únicos         3
Eventos                  58
Procesados / rechazados  58 / 0

racing   | 1 | 1 | 0 | 1 | 11 | 2
combat   | 1 | 1 | 0 | 1 | 19 | 2
connect4 | 1 | 1 | 0 | 1 | 28 | 2
```

### Registro entre pestañas

- Partida activa creada en A: el panel de B mostró `racing: 1 partida, 0 finalizadas, 1 activa, 3 eventos`; el registro de B contuvo el `matchId`. El Lobby de B mostró 0 sesiones por diseño.
- Tras finalizar: panel de B con 3 partidas; registro con 3 `matchId`; Lobby de B con 1 sesión propia.
- Tras recargar B: registro con 3 partidas; Lobby con 0 sesiones.

### Docker

| Servicio | Estado |
| --- | --- |
| `gameconsole-web-1` | `Up (healthy)`, `8088->80` |
| `gameconsole-gamestats-go-1` | `Up (healthy)` |
| `gameconsole-gamestats-scala-1` | `Up (healthy)` |
| `gameconsole-prolog-1` | `Up`, `127.0.0.1:8090` |

### CI

- Run `44403832285`: `CI`, `push`, `success`.
- Jobs: `web` success, `prolog` success, `images` success.

### Artefactos temporales

- `C:\Users\Tencio\AppData\Local\Temp\opencode\audit-ui.cjs`
- `C:\Users\Tencio\AppData\Local\Temp\opencode\audit-ui-result.json`
- `C:\Users\Tencio\AppData\Local\Temp\opencode\audit-ui-result-run1.json`
- `C:\Users\Tencio\AppData\Local\Temp\opencode\audit-crosstab-active.json`
- `C:\Users\Tencio\AppData\Local\Temp\opencode\audit-shots\`

## Próximos pasos priorizados

1. Ejecutar el workflow `Deploy` en una VM real, con los secrets configurados, y añadir un smoke test posterior al despliegue. Es el único punto que impide cerrar el requisito 10 como cumplido.
2. Incorporar al repositorio y al CI una prueba E2E de los tres juegos simultáneos, idealmente con Playwright, para cubrir ingesta, contrato, panel y Prolog en cada cambio.
3. Decidir el alcance del trabajo entre pestañas: si basta el registro/panel, documentarlo como cumplido; si se exige listar o reabrir sesiones activas de otra pestaña, añadir sincronización de sesiones y un mecanismo de estado compartido.
4. Alinear el contrato de combate: enviar el atacante/víctima en `playerId` o documentar formalmente que `/matches/{id}` y `/players/{id}/stats` no son fuentes válidas para daño; el panel debe seguir usando `/analysis`.
5. Evaluar un análisis específico de Conecta 4 en GameStats y, si se requiere, mostrar métricas detalladas en el panel en lugar de solo patrones/estado.
6. Añadir lint y build de las imágenes de GameStats al CI si se quiere que el pipeline cubra exactamente el stack integrado.

## Conclusión

GameConsole cumple 9 de los 10 requisitos verificables en el entorno actual. La integración con GameStats y Prolog funciona con partidas reales concurrentes, el contrato se respeta y el panel muestra datos verificables. El requisito 10 queda parcial porque el CI está validado pero el despliegue CD real no se ejecutó; las limitaciones restantes son conocidas y no bloquean el uso funcional de la consola.
