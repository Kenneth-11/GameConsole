const base = (process.env.BASE_URL ?? 'http://localhost:8088').replace(/\/$/, '')

function check(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function read(path, init) {
  const response = await fetch(`${base}${path}`, init)
  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  return { response, text, json }
}

function event(matchId, type, playerId, action, data) {
  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    gameId: 'connect4',
    gameVersion: '1.0.0',
    matchId,
    playerId,
    type,
    action,
    data,
  }
}

async function postEvent(payload) {
  const { response, text } = await read('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  check(
    response.status === 202 || (response.status === 422 && /duplicad/i.test(text)),
    `evento ${payload.type} rechazado: ${response.status} ${text}`,
  )
}

async function main() {
  console.log(`GameConsole smoke test → ${base}`)

  const health = await read('/api/health')
  check(health.response.ok, `GameStats no responde: ${health.response.status}`)
  console.log('  GameStats:', health.text.trim())

  const prologHealth = await read('/prolog/health')
  check(prologHealth.response.ok, `Prolog no responde: ${prologHealth.response.status}`)
  console.log('  Prolog:', prologHealth.text.trim())

  const matchId = `gc-connect4-smoke-${crypto.randomUUID()}`
  await postEvent(event(matchId, 'MATCH_STARTED', '', 'start', { mode: 'pve', rows: 6, columns: 7, depth: 3 }))
  await postEvent(event(matchId, 'PLAYER_JOINED', 'p-human', 'join', { playerName: 'Smoke', team: 'yellow' }))
  await postEvent(event(matchId, 'PLAYER_JOINED', 'p-ai', 'join', { playerName: 'IA Prolog', team: 'red' }))

  const empty = Array.from({ length: 6 }, () => Array(7).fill(0))
  const humanMove = await read('/prolog/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board: empty, player: 2, depth: 3 }),
  })
  check(humanMove.response.ok, `Prolog /decide falló: ${humanMove.response.status} ${humanMove.text}`)
  const decision = humanMove.json
  check(decision && decision.column >= 1 && decision.column <= 7, 'Prolog devolvió una columna inválida')
  console.log(`  IA: columna ${decision.column}, ${decision.nodes} nodos, ${decision.ms} ms`)

  await postEvent(event(matchId, 'MOVE', 'p-human', 'drop', { column: 4, row: 6, moveIndex: 1, source: 'human' }))
  await postEvent(
    event(matchId, 'AI_DECISION', 'p-ai', 'decide', {
      column: decision.column,
      score: decision.score,
      nodes: decision.nodes,
      depth: decision.depth,
      ms: decision.ms,
    }),
  )
  await postEvent(
    event(matchId, 'MOVE', 'p-ai', 'drop', {
      column: decision.column,
      row: decision.column === 4 ? 5 : 6,
      moveIndex: 2,
      source: 'ai',
    }),
  )
  await postEvent(
    event(matchId, 'MATCH_FINISHED', '', 'finish', {
      winnerPlayerId: 'p-ai',
      durationMs: 1500,
      moves: 2,
    }),
  )

  let analysis = null
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await read(`/api/matches/${encodeURIComponent(matchId)}/analysis`)
    if (current.response.status === 200 && current.json) {
      analysis = current.json
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  check(analysis, 'el análisis no llegó a estado 200')
  console.log(`  Análisis: ${analysis.status}, patrones=${analysis.patterns?.length ?? 0}`)

  const stats = await read('/api/stats')
  check(stats.response.ok && stats.json, 'GET /api/stats falló')
  const connect4 = stats.json.byGame?.connect4
  check(connect4, 'byGame.connect4 no aparece en /stats')
  console.log(
    `  byGame.connect4: ${connect4.matches} partidas, ${connect4.finished} finalizadas, ${connect4.events} eventos`,
  )

  console.log('Smoke test OK')
}

main().catch((error) => {
  console.error('Smoke test FALLÓ:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
