# Plan final de desarrollo — GameConsole

- Fecha: 2026-11-18
- Entrega: viernes 20 de noviembre de 2026, antes de las 22:00
- Enunciado: recibido en la conversación. Fuente principal de este plan.
- Repositorio: `C:\Users\Tencio\Documents\Lenguajes-Programacion\GameConsole`
- Commit actual: `b714b672389e3c28916f96f3bdaf4dbecb6ad554`
- GameStats: rama local `feature/gameconsole-integration`, commit `da412e6`; **no está publicada en `origin`**
- Este documento no modifica código, configuración, GameStats ni Git.

## 0. Lectura del enunciado

El enunciado confirma que **el deployment y el video son obligatorios**, no opcionales:

- Sección 9: instalación, ejecución integrada y deployment reproducibles.
- Sección 10: repositorio con historial, CI/CD que compile y prepare la ejecución integrada, y deployment de una versión funcional en un entorno definido.
- Sección 11: video de los tres juegos, concurrencia, Prolog y panel; máximo aproximado de 15 minutos.
- Sección 14: link del video en una plataforma pública y entrega por Tec Digital.

Por tanto, el estado “9/10” de la auditoría no significa que el proyecto esté listo para entregar. Faltan evidencias de entrega, integración en CI y deployment.

## 1. Estado actual frente al enunciado

| Requisito del enunciado | Estado | Evidencia / brecha |
| --- | --- | --- |
| Exactamente tres juegos cargables | Cumplido | Racing, combat y connect4 |
| Programación orientada a objetos | Cumplido | `BaseGame` abstracta, tres subclases, encapsulación y polimorfismo |
| Varias instancias y pestañas | Cumplido | E2E con 3 pestañas y 3 `matchId` |
| Al menos un juego usuario vs CPU con Prolog | Cumplido | Connect4 con minimax alfa-beta y 8 llamadas reales |
| Eventos de inicio, desarrollo y fin | Cumplido | 58 eventos, 3 colas FIFO, sin mezcla |
| Compatibilidad con GameStats | Cumplido | 58/58 `202`, 0 rechazados, 3 análisis |
| Panel con estadísticas generales y por juego | Cumplido | `byGame` y totales desde `/stats`; análisis por partida |
| Instancias ejecutadas por juego | Cumplido | Campo `matches` de cada `byGame` |
| Actualización durante partidas | Cumplido | Polling cada 3 s; prueba con partida activa |
| Docker + Prolog + GameStats | Cumplido | Stack completo probado |
| Instrucciones de ejecución | Cumplido parcial | README y docs; falta URL/video final |
| Historial Git de desarrollo | Parcial | Solo un commit en GameConsole; GameStats tiene historial |
| CI/CD que prepare ejecución integrada | Implementado localmente | Job `integration` clona GameStats, construye las 4 imágenes y ejecuta smoke; pendiente commit/push y run en GitHub |
| Deployment funcional | Preparado | Workflow y script actualizan GameStats; rama publicada; pendiente ejecutar `Deploy` en la VM y validar URL |
| Video demostrativo público | Pendiente | No existe video ni link |
| Documentación breve y link del video | Parcial | Documentación técnica existe; falta link y actualización final |

### Conclusión de estado

El núcleo funcional está implementado y probado. Lo que falta para cumplir el enunciado es principalmente **entrega e integración**, no reescribir juegos:

1. Publicar el GameStats integrado.
2. Hacer que el CI construya el sistema integrado.
3. Desplegar en un entorno definido y obtener evidencia.
4. Grabar el video y publicarlo.
5. Cerrar documentación, commits y tag.

## 2. Pendientes priorizados

### P0 — Obligatorio para cumplir el enunciado

#### P0-1. Publicar la versión integrada de GameStats

**Qué falta**

GameConsole depende de `GameStats` con soporte `connect4` y `byGame`. Esa versión está en la rama local `feature/gameconsole-integration` (`da412e6`), pero `git ls-remote origin` solo muestra `main` (`247a055`). Un clon limpio, el CI o una VM no pueden obtener el código integrado.

**Por qué es necesario**

Sin ese artefacto, el deployment y el CI no pueden construir el sistema real. `main` de GameStats no acepta `connect4`; usar esa versión rompería el tercer juego. El enunciado exige una ejecución integrada reproducible.

**Archivos/componentes**

- Remoto de GameStats: publicar `feature/gameconsole-integration` o integrarla en `main` tras verificar.
- `GameConsole/docker-compose.yml`: sin cambios si se publica la rama; solo verificar las rutas `../GameStats`.
- `docs/despliegue.md`: indicar rama/tag exacto que debe clonarse.
- No modificar código de GameStats en esta tarea; solo publicar lo ya verificado.

**Cómo comprobarlo**

1. `git ls-remote --heads origin` muestra la rama publicada, o `main` contiene el commit integrado.
2. Un clon limpio en otra carpeta contiene `SupportedGameIDs` con `connect4` y `byGame` en `/stats`.
3. `docker compose build` funciona desde `GameConsole` con ese clon.
4. El CI puede hacer checkout del repositorio y construir el stack.

**Riesgo si falta**

Crítico: deployment y CI no reproducen el sistema; el video local no sería reproducible desde el repositorio.

**Dependencia**

Requiere autorización para push/merge en GameStats. No hacer force-push ni reescribir `main`.

#### P0-2. Completar el CI/CD para la ejecución integrada

**Estado:** implementado localmente y validado con `docker compose build`, `up --wait` y smoke; pendiente commit/push y run real en GitHub.

**Qué falta**

El CI actual (`ci.yml`) ejecuta frontend, plunit y construye imágenes web/Prolog. No clona GameStats, no valida `docker-compose.yml` con los cuatro servicios y no construye las imágenes de GameStats. El job `images` no prueba la ejecución integrada.

**Por qué es necesario**

La sección 10 exige un pipeline que ejecute la compilación y las tareas necesarias para preparar la ejecución integrada. El pipeline actual valida partes, no el sistema que se entrega.

**Archivos/componentes**

- `.github/workflows/ci.yml`: nuevo job `integration` o ampliación de `images`.
- `.github/workflows/deploy.yml`: preflight de GameStats y smoke post-deploy.
- `scripts/deploy.sh`: mismas comprobaciones.
- `scripts/smoke.mjs`: reutilizar; no agregar dependencias.
- `docs/despliegue.md`: documentar el pipeline real.

**Implementación sugerida**

1. Checkout de GameConsole.
2. Clonar GameStats en `../GameStats` con la rama/tag publicado en P0-1.
3. Ejecutar `docker compose config`.
4. Ejecutar `docker compose build` para web, Prolog, Go y Scala.
5. Opcional recomendado: `docker compose up -d`, esperar healthchecks y ejecutar `node scripts/smoke.mjs`.
6. Publicar logs/capturas como artefacto si falla.

**Cómo comprobarlo**

- Un push a `main` ejecuta el job integrado y termina en `success`.
- El job construye las cuatro imágenes.
- `docker compose config` y, si se levanta, `smoke.mjs` pasan.
- El workflow de deploy reutiliza el mismo preflight.

**Riesgo si falta**

Alto: el CI puede estar verde sin que el sistema integrado compile o arranque. Es un incumplimiento directo de la sección 10.

**Dependencia**

Depende de P0-1. Sin rama publicada, el CI no puede clonar la versión integrada.

#### P0-3. Deployment funcional en un entorno definido

**Estado:** workflow y script preparados para actualizar GameStats y esperar healthchecks; pendiente ejecución en la VM.

**Qué falta**

Ejecutar el despliegue en una VM o entorno definido, obtener una URL/acceso reproducible y verificar el stack completo. El workflow `Deploy` existe, pero no se ha ejecutado. Tampoco hay evidencia de que la VM tenga GameStats hermano.

**Por qué es necesario**

La sección 10 exige deployment de una versión funcional, no solo Docker local. La sección 9 exige una forma reproducible de instalación, ejecución y deployment.

**Archivos/componentes**

- `.github/workflows/deploy.yml`
- `scripts/deploy.sh`
- `docs/despliegue.md`
- `README.md` (URL y credenciales de acceso si aplica)
- `docker-compose.yml` solo si el preflight detecta un problema real

**Cómo comprobarlo**

1. Run de `Deploy` con `success`.
2. `https://<host>/healthz` responde `ok`.
3. `/api/health` y `/prolog/health` responden `200`.
4. `BASE_URL=https://<host> node scripts/smoke.mjs` termina en `Smoke test OK`.
5. Se juega una partida de cada juego desde la URL.
6. El panel muestra partidas por juego y totales.
7. Captura del run y de la URL.

**Riesgo si falta**

Crítico: el enunciado pide deployment; sin él, el proyecto queda incompleto aunque el código funcione localmente.

**Dependencia**

Requiere P0-1 y, preferiblemente, P0-2. Requiere VM, SSH y secrets. Si no hay VM, definir un entorno local documentado no cumple el “no solamente ejecución local”; habría que declararlo como limitación.

### P1 — Correcciones importantes

#### P1-1. Mostrar métricas de análisis por partida en el panel

**Qué falta**

El panel muestra totales y `byGame`, pero las filas de partidas solo muestran estado de análisis y patrones. Para racing/combat normalmente no hay patrones, así que no se ven `bestLapTime`, `totalDamage`, etc., aunque ya se descargan desde `/analysis`.

**Por qué es necesario**

La sección 8 pide presentar las estadísticas disponibles por juego y generales. Los datos están, pero la presentación no los aprovecha; el profesor tendría que abrir el JSON.

**Archivos**

- `web/src/ui/Dashboard.tsx`
- `web/src/styles.css`
- Opcional: `web/src/core/analysisSummary.ts` y test puro de formateo
- No modificar `GameStatsClient` ni GameStats

**Validación**

- Una partida de cada juego, análisis `analyzed`.
- Comparar en pantalla con `/analysis`: vueltas, mejor tiempo, ataques, daño, eliminaciones, eventos y jugadores.
- Verificar `patterns: null`.
- Captura del panel.

**Riesgo si falta**

Medio-bajo: el requisito ya tiene datos reales, pero la demostración y la defensa son más débiles.

**Dependencia**

Ninguna. Hacerlo antes del video.

#### P1-2. Fortalecer el historial de desarrollo

**Qué falta**

GameConsole tiene un solo commit (`b714b67`). El enunciado pide un repositorio con historial de desarrollo. Un único commit no demuestra el flujo, aunque el código esté completo.

**Por qué es necesario**

La sección 10 evalúa el flujo de desarrollo y entrega, no solo el resultado final.

**Archivos**

- No reescribir historia.
- Harán commits pequeños y descriptivos por tarea: P0-1 (si toca repo GameConsole), P0-2, P1-1, documentación, video/evidencia.
- `docs/despliegue.md` y `README.md` en commits separados si aplica.

**Validación**

- `git log --oneline` muestra varios commits significativos.
- Cada commit deja el proyecto compilando.
- El commit final tiene CI verde.

**Riesgo si falta**

Bajo-medio: es un requisito de proceso; no afecta la ejecución, pero puede restar en la evaluación.

**Dependencia**

Hacer commits durante el trabajo, no al final. No hacer commit hasta que el usuario lo autorice.

#### P1-3. Aclarar en la documentación el alcance de las estadísticas crudas

**Qué falta**

`GET /matches/{id}` y `GET /players/{id}/stats` muestran daño de combate en cero por una limitación del agregador Go; `/analysis` es correcto. No es un incumplimiento del panel, pero puede confundir en la defensa.

**Por qué es necesario**

El panel y la documentación deben dejar claro que la fuente oficial es `/analysis`, sin duplicar cálculos ni prometer endpoints crudos que no son confiables.

**Archivos**

- `docs/arquitectura.md` o `docs/contrato-eventos.md`
- `docs/auditoria-funcional.md` si se actualiza
- No modificar GameStats

**Validación**

- La documentación indica la fuente correcta.
- El video/defensa muestra `/analysis`, no los endpoints crudos.
- No se afirma que `/matches` está corregido.

**Riesgo si falta**

Bajo para el requisito; medio para la defensa si el profesor revisa endpoints.

**Dependencia**

Ninguna.

### P2 — Entrega y presentación

#### P2-1. Video demostrativo público

**Qué falta**

No hay video ni guion. El enunciado permite hasta aproximadamente 15 minutos y exige link público.

**Por qué es necesario**

Es un entregable explícito de la sección 11 y la forma más directa de demostrar concurrencia, Prolog y panel.

**Archivos**

- `docs/guion-video.md` (nuevo)
- `README.md` con el link
- Video en YouTube/plataforma pública o enlace permitido por el curso

**Validación**

- Se ven los tres juegos completos o representativos.
- Se ven dos pestañas/instancias simultáneas.
- Se ve la decisión de Prolog y se explica el algoritmo.
- Se ve el panel actualizándose con datos de GameStats.
- Se muestra Docker, CI y, si existe, la URL desplegada.
- Duración ≤ 15 minutos.

**Riesgo si falta**

Crítico para la entrega: es un entregable obligatorio.

#### P2-2. Documentación breve, instalación y decisiones

**Qué falta**

La documentación técnica existe, pero debe cerrarse con URL de deployment, link del video, comandos finales y rama/tag de GameStats.

**Archivos**

- `README.md`
- `docs/despliegue.md`
- `docs/arquitectura.md`
- `docs/revision-contra-enunciado.md` (nuevo)

**Validación**

- Un clon limpio sigue las instrucciones y levanta el stack.
- La URL y el video funcionan.
- La matriz requisito → implementación → prueba está completa.
- No hay pasos que dependan de archivos locales no versionados.

**Riesgo si falta**

Alto: el profesor no puede reproducir el deployment o no encuentra el video.

#### P2-3. Cerrar Git, tag y entrega

**Qué falta**

La auditoría y este plan están sin commit. No hay tag/release final.

**Archivos**

- `docs/auditoria-funcional.md`
- `docs/plan-final-desarrollo.md`
- `docs/revision-contra-enunciado.md`
- `README.md`

**Validación**

- `git status` limpio.
- CI verde en el commit final.
- Tag `v1.0.0` o el nombre acordado.
- URL del repositorio, URL desplegada y video en el README.
- Entrega en Tec Digital antes de las 22:00.

**Riesgo si falta**

Alto: una entrega sin CI verde o sin link es una entrega incompleta.

#### P2-4. Conservar evidencia E2E (opcional)

**Qué falta**

El harness de los tres juegos está en `%TEMP%`, fuera del repositorio.

**Decisión**

No agregar Playwright al CI antes de la entrega; el CI integrado y el smoke ya cubren la preparación. Conservar JSON, capturas y guion como evidencia. Si sobra tiempo, copiar el script como documentación, sin bloquear el pipeline.

**Riesgo**

Bajo; no es requisito del enunciado.

## 3. Orden recomendado

1. **P0-1:** publicar GameStats integrado (push de rama o merge autorizado). Es el desbloqueo de todo.
2. **P0-2:** CI de integración con GameStats y las cuatro imágenes.
3. **P1-1:** panel con métricas de `/analysis`.
4. **P1-2:** commits pequeños durante el trabajo.
5. **P0-3:** deployment final en VM/entorno definido, smoke y URL.
6. **P2-1:** grabar video sobre el sistema desplegado o, si falla, sobre el local final.
7. **P2-2:** documentación, matriz y links.
8. **P2-3:** commit final, tag, push y verificación del CI.
9. **P2-4:** solo si sobra tiempo.

### Regla de congelamiento

Congelar código el viernes 20 a las 12:00. Después solo deployment, video, documentación y correcciones críticas. No iniciar funciones nuevas después del jueves.

## 4. Archivos por tarea

| Tarea | Archivos principales | Evidencia |
| --- | --- | --- |
| P0-1 GameStats | Remoto GameStats, `docs/despliegue.md` | Rama/tag visible en `origin`, clon limpio |
| P0-2 CI | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/deploy.sh` | Run verde con 4 imágenes y smoke |
| P0-3 Deployment | `docs/despliegue.md`, `README.md`, `deploy.yml` | URL, run, smoke, capturas |
| P1-1 Panel | `web/src/ui/Dashboard.tsx`, `web/src/styles.css` | Comparación DOM vs `/analysis` |
| P1-2 Git | Commits pequeños | `git log` y CI por commit |
| P1-3 Docs | `docs/arquitectura.md`, `docs/contrato-eventos.md` | Fuente `/analysis` documentada |
| P2-1 Video | `docs/guion-video.md`, `README.md` | Link público ≤ 15 min |
| P2-2 Docs | `README.md`, `docs/despliegue.md`, `docs/revision-contra-enunciado.md` | Clon limpio reproducible |
| P2-3 Cierre | Docs y repo | `git status` limpio, tag, CI verde |

## 5. Pruebas de validación

### Núcleo existente

```bash
cd web && npm test && npm run lint && npm run build
cd ../prolog && docker run --rm -v "${PWD}:/app" -w /app swipl:9.2.9 \
  swipl -q -g run_tests -t halt tests.pl
cd ../GameStats/go-service && go test ./... && go vet ./...
cd ../../GameConsole && docker compose config --quiet
```

### P0-2 CI integrado

- El job clona GameStats y construye las cuatro imágenes.
- `docker compose config` pasa.
- Si se levanta, `node scripts/smoke.mjs` pasa.
- El run queda en GitHub Actions con URL.

### P0-3 Deployment

- `Deploy` con `success`.
- `/healthz`, `/api/health`, `/prolog/health` responden.
- `BASE_URL=https://... node scripts/smoke.mjs`.
- Tres partidas reales desde la URL.
- Panel con estadísticas por juego y generales.

### P1-1 Panel

- Jugadas una de racing, combat y connect4.
- Valores de pantalla iguales a `/analysis`.
- `patterns: null` no rompe.
- Captura y video.

### P2-1 Video

- Tres juegos, concurrencia, Prolog, panel, Docker/CI/deployment.
- Link público.
- Ensayo previo completo.

## 6. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| GameStats integrado no se publica | Media | Crítico | P0-1 primero; autorización explícita |
| CI no construye GameStats | Alta | Alto | Job integrado con clon y compose |
| No hay VM/secrets | Media | Crítico | Aprovisionar ya; fallback local documentado |
| Deployment falla por rutas hermanas | Media | Alto | Preflight de `../GameStats` |
| Video se deja para el final | Alta | Crítico | Grabar primer corte el jueves |
| Un solo commit en GameConsole | Alta | Medio | Commits pequeños durante el trabajo |
| Se invierte tiempo en extras | Media | Alto | Congelar P1 el jueves; priorizar P0/video |

## 7. Distribución del tiempo

| Bloque | Trabajo | Salida |
| --- | --- | --- |
| Miércoles 18, noche | P0-1 autorización/publicación; P0-2 diseño del job; P1-1 panel | GameStats accesible, panel mejorado |
| Jueves 19, mañana | P0-2 CI integrado; commits; pruebas | Run verde con 4 imágenes |
| Jueves 19, tarde | P0-3 deployment; smoke | URL funcional o fallback declarado |
| Jueves 19, noche | Guion y primer corte de video | Video base |
| Viernes 20, mañana | Pruebas finales, docs, matriz, links | Entrega reproducible |
| Viernes 20, mediodía | Congelar código; commit candidato | `git status` limpio |
| Viernes 20, tarde | Video final, tag, push, Tec Digital | Entrega antes de 22:00 |
| Viernes 20, 18:00–22:00 | Colchón | Correcciones críticas |

### Si el tiempo se reduce

1. P0-1, P0-2, P0-3 y smoke.
2. Video y links.
3. P1-1 panel.
4. Documentación/matriz.
5. P1-2 historial; P2-4 E2E.

No se debe gastar tiempo en Lobby cross-tab, `playerId` de combate ni análisis específico de Conecta 4 antes de cerrar deployment, CI, video y documentación. Esas son mejoras no exigidas explícitamente por el enunciado.

## 8. Decisiones de liderazgo técnico

- No reescribir juegos, colas, clientes ni GameStats.
- No agregar dependencias nuevas.
- No cambiar tecnologías.
- No tocar GameStats salvo publicar la rama ya verificada, con autorización.
- No declarar deployment sin URL y smoke reales.
- No declarar cumplido el CI integrado si no construye GameStats.
- No afirmar que un video existe si no está publicado.
- No invertir en funciones no exigidas antes de los entregables obligatorios.

## 9. Estado y siguiente tarea

**P0-1 completado:** la rama `feature/gameconsole-integration` de GameStats está publicada en `origin` (`da412e6`).

**P0-2 implementado localmente:** el job `integration` clona GameStats, valida Compose, construye las cuatro imágenes, levanta el stack y ejecuta `smoke.mjs`. Validado con `actionlint`, `docker compose build`, `up --wait` y smoke. Pendiente commit/push y run real.

**P0-3 preparado:** `deploy.yml` y `scripts/deploy.sh` actualizan el repo hermano GameStats antes de reconstruir. Pendiente ejecutar `Deploy` con la VM/secrets.

Siguiente tarea: autorizar commit/push de GameConsole para ejecutar el CI integrado; después ejecutar `Deploy` y validar la URL. La primera tarea de código pendiente es **P1-1**, el panel con métricas de `/analysis`, pero no debe retrasar P0-3.
