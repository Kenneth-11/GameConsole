# Arquitectura de GameConsole

## Responsabilidades

| Componente | Responsabilidad | No hace |
| --- | --- | --- |
| SPA React+TS | UI, estado de la partida, reglas del juego, generación de eventos | Validar o almacenar eventos; calcular estadísticas |
| `GameStatsClient` | Enviar eventos y consultar `/stats` y `/analysis` | Reintentar con orden distinto o deduplicar por su cuenta |
| Nginx | Servir assets y proxy same-origin `/api`, `/prolog` | Lógica de negocio |
| SWI-Prolog | Decidir la jugada de Conecta 4 (minimax alfa-beta) | Mantener el estado de la partida |
| GameStats (Go+Scala) | Validar, almacenar, analizar y agregar | Conocer detalles de la UI |

## Clases del núcleo (OOP)

```
Player
BaseGame (abstracta)
 ├─ RacingGame
 ├─ CombatGame
 └─ Connect4Game

EventQueue ──> GameStatsClient ──> /api/events
Connect4Game ─> PrologClient ────> /prolog/decide
BaseGame ─────> MatchRegistry ───> localStorage
```

- **Abstracción:** `BaseGame` define ciclo de vida (`start`, `play`, `finish`), cola, jugadores, log y registro. Las subclases solo implementan reglas y `snapshot`.
- **Herencia:** los tres juegos heredan el envío ordenado y el manejo de errores.
- **Polimorfismo:** la UI consume `GameSnapshot` (`kind: racing | combat | connect4`) y delega en `GameBoard`; `createGame` devuelve una `BaseGame`.
- **Encapsulamiento:** tableros, HP, distancias y colas son privados; la UI solo lee snapshots inmutables.

## Flujo de una partida

1. La UI crea la instancia (`createGame`) con un `matchId` único.
2. `start()` envía `MATCH_STARTED` y **espera** su `202`; luego envía un `PLAYER_JOINED` por jugador.
3. Cada acción llama a `play()`, que actualiza el estado y encola eventos en FIFO. La promesa no resuelve hasta que el evento anterior fue aceptado.
4. En Conecta 4, tras el `MOVE` humano se consulta `POST /prolog/decide`; la respuesta se registra con `AI_DECISION` y luego `MOVE`.
5. Al terminar se envía `MATCH_FINISHED` y se cierra la cola: no se permiten más eventos.
6. El registro actualiza el estado en `localStorage`; el panel lo lee y consulta el análisis a GameStats.

## Concurrencia

- Cada partida tiene su propia instancia, `matchId` y `EventQueue`; no comparten cola.
- Varias pestañas pueden jugar a la vez. El registro usa `localStorage` y se refresca con el evento `storage` y al recuperar el foco.
- El servidor GameStats rutea por `matchId`, por lo que el orden solo debe garantizarse dentro de cada partida.

## Manejo de fallos

| Situación | Comportamiento |
| --- | --- |
| Red caída o `400` | La cola marca error, detiene envíos posteriores y la UI lo muestra |
| `422` duplicado | Se considera entregado (dedupe global de GameStats) |
| Prolog caído o timeout | La partida queda en `error`; el botón **Reintentar IA** reconsulta sin reiniciar |
| Análisis `202` | El panel muestra `pendiente` y reintenta en el siguiente polling |
| GameStats reiniciado | Las partidas en memoria desaparecen; el panel marca el análisis como no disponible |

## Panel

`Dashboard` consulta cada 3 s `GET /api/stats` y, para las últimas partidas del registro, `GET /api/matches/{id}/analysis`. Solo renderiza: agregados por juego, patrones y estado. No deriva métricas ni reintenta cálculos.
