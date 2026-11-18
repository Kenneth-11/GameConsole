# Contrato de eventos

GameConsole implementa el contrato verificado de GameStats (P0). Campos comunes:

| Campo | Tipo | Obligatorio | Regla |
| --- | --- | --- | --- |
| `eventId` | string | sí | UUID único; GameStats deduplica globalmente |
| `timestamp` | string | sí | ISO 8601 UTC con milisegundos (`...T12:00:00.000Z`) |
| `gameId` | string | sí | `racing`, `combat` o `connect4` |
| `gameVersion` | string | sí | `1.0.0` |
| `matchId` | string | sí | `gc-<gameId>-<uuid>` |
| `playerId` | string | no | vacío para eventos de sistema |
| `type` | string | sí | ver tablas |
| `action` | string | no | etiqueta legible |
| `data` | object/null | no | según el tipo |

## Reglas de integración

1. Enviar `MATCH_STARTED` y esperar el `202` antes de cualquier otro evento.
2. Una cola FIFO por partida; no enviar el siguiente evento hasta recibir el `202` del anterior.
3. Nunca enviar eventos después de `MATCH_FINISHED`.
4. Un `422` cuyo cuerpo contenga “duplicado” se trata como entregado.
5. Un `400` o error de red detiene la cola y se muestra en la UI.
6. Usar timestamps actuales (con `.fffZ`), no futuros.

## `racing`

| Tipo | `data` |
| --- | --- |
| `MATCH_STARTED` | `mode`, `lapLength`, `totalLaps` |
| `PLAYER_JOINED` | `playerName`, `team` |
| `POSITION_CHANGED` | `fromPosition`, `toPosition` |
| `LAP_COMPLETED` | `lapNumber` ≥ 1, `lapTimeMs` > 0, `averageSpeed`, `position` ≥ 1 |
| `MATCH_FINISHED` | `winnerPlayerId`, `durationMs`, `totalLaps`, `winnerLaps`, `winnerDistance` |

```json
{
  "eventId": "8d3c9e2a-6b1f-4c0e-9d55-2a7f1b3c4d5e",
  "timestamp": "2026-11-18T18:30:12.345Z",
  "gameId": "racing",
  "gameVersion": "1.0.0",
  "matchId": "gc-racing-6f2a...",
  "playerId": "p-human",
  "type": "LAP_COMPLETED",
  "action": "lap",
  "data": {
    "lapNumber": 1,
    "lapTimeMs": 4210,
    "averageSpeed": 28,
    "position": 1
  }
}
```

## `combat`

| Tipo | `data` |
| --- | --- |
| `MATCH_STARTED` | `mode`, `maxHp` |
| `PLAYER_JOINED` | `playerName`, `team` |
| `PLAYER_ATTACKED` | `attacker`, `target`, `damage` ≥ 0, `weapon`, `distance` |
| `PLAYER_HEALED` | `amount`, `hp` (tipo desconocido aceptado) |
| `PLAYER_ELIMINATED` | `victim`, `killer`, `weapon` |
| `MATCH_FINISHED` | `winnerPlayerId`, `durationMs`, `totalMoves`, `winnerHp` |

```json
{
  "eventId": "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "timestamp": "2026-11-18T18:31:04.120Z",
  "gameId": "combat",
  "gameVersion": "1.0.0",
  "matchId": "gc-combat-1a2b...",
  "playerId": "",
  "type": "PLAYER_ATTACKED",
  "action": "attack",
  "data": {
    "attacker": "p-human",
    "target": "p-cpu",
    "damage": 34,
    "weapon": "shotgun",
    "distance": 57
  }
}
```

## `connect4`

| Tipo | `data` |
| --- | --- |
| `MATCH_STARTED` | `mode`, `rows`, `columns`, `depth` |
| `PLAYER_JOINED` | `playerName`, `team` |
| `MOVE` | `column` 1..7, `row` 1..6, `moveIndex`, `source` (`human`/`ai`) |
| `AI_DECISION` | `column`, `score`, `nodes`, `depth`, `ms` |
| `MATCH_FINISHED` | `winnerPlayerId` (`p-human`, `p-ai` o `draw`), `durationMs`, `moves` |

```json
{
  "eventId": "c9f8e7d6-a5b4-4c3d-9e2f-1a0b9c8d7e6f",
  "timestamp": "2026-11-18T18:32:44.010Z",
  "gameId": "connect4",
  "gameVersion": "1.0.0",
  "matchId": "gc-connect4-9f8e...",
  "playerId": "p-ai",
  "type": "AI_DECISION",
  "action": "decide",
  "data": {
    "column": 4,
    "score": 102,
    "nodes": 2815,
    "depth": 5,
    "ms": 811
  }
}
```

Scala no tiene analizador específico de `connect4`: al recibir `MATCH_FINISHED`, GameStats devuelve `statistics` con `eventsCount`, `playersCount` y `note`, y `patterns` en `null` si no hay patrones.
