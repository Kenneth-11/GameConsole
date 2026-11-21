# Guion del video demostrativo

- Duración objetivo: 12–14 minutos; máximo 15.
- Modalidad: ejecución local con Docker Compose.
- Requisito: el stack debe estar limpio y funcionando antes de grabar.
- Enlace público: https://youtu.be/e4ABOJuHwFk

## Preparación

```powershell
Set-Location "C:\ruta\a\Lenguajes-Programacion\GameConsole"
docker compose down --remove-orphans
docker compose up -d --build --wait
docker compose ps
Start-Process "http://localhost:8088"
```

Abrir tres pestañas en `http://localhost:8088`. Usar un perfil limpio o borrar los datos del sitio para no arrastrar partidas de pruebas. Tener a mano una terminal en el repositorio.

## Guion

### 0:00–0:45 — Presentación

- Nombre del proyecto: GameConsole.
- Tres juegos: carrera, combate y Conecta 4.
- Integración: SPA React + TypeScript, SWI-Prolog y GameStats Go/Scala.
- Aclarar que GameConsole envía eventos; GameStats valida, almacena y analiza.

### 0:45–2:00 — Docker y servicios

Mostrar en terminal:

```powershell
docker compose ps
docker compose logs --tail=20 gamestats-go
```

- Cuatro contenedores: web, Prolog, GameStats Go y GameStats Scala.
- La consola está en `http://localhost:8088`.
- Nginx hace proxy de `/api` y `/prolog`, sin CORS.

Abrir el Lobby y mostrar las tres tarjetas.

### 2:00–4:30 — Carrera

- Crear la partida de carrera.
- Mostrar `matchId`, estado `en juego`, tablero y registro de eventos.
- Alternar Avanzar y Turbo hasta `finalizada`.
- Mostrar que el contador de eventos enviados coincide con el log.
- Abrir el panel y señalar los eventos y el análisis de la partida.

### 4:30–7:00 — Combate

- Volver al Lobby y crear combate.
- Mostrar ataque, escopeta, defensa y curación.
- Jugar hasta `finalizada`.
- En el log, señalar `PLAYER_ATTACKED`, `PLAYER_ELIMINATED` y `MATCH_FINISHED`.
- En el panel, mostrar que el análisis reporta daño y eliminaciones reales.

### 7:00–10:00 — Conecta 4 y Prolog

- Crear Conecta 4 con profundidad 4.
- Jugar varios movimientos.
- Detenerse en una respuesta de la IA y leer la línea:
  `IA: columna N · score ... · nodos ... · ms ...`.
- Explicar en una frase: minimax con poda alfa-beta en SWI-Prolog.
- Terminar la partida y mostrar el análisis genérico de GameStats.

### 10:00–12:00 — Concurrencia

- En tres pestañas, crear una partida de cada juego.
- Alternar entre pestañas y mostrar que cada una conserva su `matchId` y su cola.
- Mostrar el panel con las partidas activas y el registro compartido.
- Señalar que GameStats recibe las partidas sin mezclar eventos.

### 12:00–14:00 — Panel y reinicio

- Mostrar totales, tabla por juego y estado `pendiente`.
- Avanzar una partida activa y esperar el polling de 3 s.
- Mostrar que los eventos y el panel se actualizan.
- Opcional: ejecutar `docker compose restart`, esperar y mostrar que GameStats pierde el estado en memoria, como está documentado.

### 14:00–15:00 — Pruebas y cierre

Mostrar, si el tiempo lo permite:

```powershell
Set-Location web
npm test
npm run lint
npm run build
Set-Location ..
node scripts/smoke.mjs
```

Cerrar con:

- Validación local completa aprobada.
- Sin cambios en GameStats.
- Documentación y comandos en `README.md` y `docs/despliegue.md`.

## Lista de comprobación

- [ ] Se ven los tres juegos completos o representativos.
- [ ] Se ve al menos una decisión real de Prolog.
- [ ] Se ven dos o tres partidas simultáneas.
- [ ] Se ve el panel actualizándose con datos de GameStats.
- [ ] Se explica que GameConsole no calcula estadísticas.
- [ ] Se muestra Docker y el arranque local.
- [ ] La duración no supera 15 minutos.
- [x] El video se publica y el enlace se agrega al README.
