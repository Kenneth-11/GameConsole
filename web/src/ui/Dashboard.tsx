import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameStatsClient } from '../core/GameStatsClient'
import { MatchRegistry } from '../core/MatchRegistry'
import type { AnalysisResponse, MatchRecord, StatsResponse } from '../core/types'

type AnalysisEntry = AnalysisResponse | { status: 'error'; error: string }

const KNOWN_GAMES = ['racing', 'combat', 'connect4'] as const

function analysisLabel(entry: AnalysisEntry | undefined): string {
  if (!entry) return 'sin datos'
  if (entry.status === 'pending') return 'pendiente'
  if (entry.status === 'error') return entry.error
  return 'analizada'
}

export function Dashboard() {
  const clients = useMemo(
    () => ({ stats: new GameStatsClient(), registry: new MatchRegistry() }),
    [],
  )
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [analyses, setAnalyses] = useState<Record<string, AnalysisEntry>>({})
  const [error, setError] = useState('')
  const loading = useRef(false)

  const load = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    try {
      const nextStats = await clients.stats.getStats()
      setStats(nextStats)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    }

    const records = clients.registry.list().slice(0, 8)
    setMatches(records)
    const entries = await Promise.all(
      records.map(async (record): Promise<[string, AnalysisEntry]> => {
        try {
          return [record.matchId, await clients.stats.getAnalysis(record.matchId)]
        } catch (analysisError) {
          return [
            record.matchId,
            {
              status: 'error',
              error: analysisError instanceof Error ? analysisError.message : 'sin análisis',
            },
          ]
        }
      }),
    )
    setAnalyses(Object.fromEntries(entries) as Record<string, AnalysisEntry>)
    loading.current = false
  }, [clients])

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load()
    }, 0)
    const interval = window.setInterval(() => {
      void load()
    }, 3000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [load])

  const byGame = stats?.byGame ?? {}

  return (
    <section className="page">
      <header className="match-head">
        <div>
          <p className="eyebrow">Datos entregados por GameStats</p>
          <h1>Panel estadístico</h1>
          <p className="muted small">
            GameConsole solo consulta y presenta; el cálculo vive en GameStats.
          </p>
        </div>
        <button className="ghost" onClick={() => void load()}>
          Actualizar
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {!stats && !error ? <p className="muted">Consultando GameStats...</p> : null}

      {stats ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span>Partidas</span>
              <strong>{stats.totalMatches}</strong>
            </div>
            <div className="stat">
              <span>Jugadores únicos</span>
              <strong>{stats.totalPlayers}</strong>
            </div>
            <div className="stat">
              <span>Eventos</span>
              <strong>{stats.totalEvents}</strong>
            </div>
            <div className="stat">
              <span>Procesados / rechazados</span>
              <strong>
                {stats.processed} / {stats.rejectedEvents}
              </strong>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Agregado por juego</h3>
              <span className="pill small">GET /api/stats → byGame</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Juego</th>
                  <th>Partidas</th>
                  <th>Finalizadas</th>
                  <th>Activas</th>
                  <th>Analizadas</th>
                  <th>Eventos</th>
                  <th>Jugadores</th>
                </tr>
              </thead>
              <tbody>
                {KNOWN_GAMES.map((gameId) => {
                  const row = byGame[gameId] ?? {
                    matches: 0,
                    finished: 0,
                    active: 0,
                    analyzed: 0,
                    events: 0,
                    players: 0,
                  }
                  return (
                    <tr key={gameId}>
                      <td>
                        <span className={`game-badge ${gameId}`}>{gameId}</span>
                      </td>
                      <td>{row.matches}</td>
                      <td>{row.finished}</td>
                      <td>{row.active}</td>
                      <td>{row.analyzed}</td>
                      <td>{row.events}</td>
                      <td>{row.players}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Partidas registradas por esta consola</h3>
              <span className="pill small">{matches.length} recientes</span>
            </div>
            {matches.length === 0 ? (
              <p className="muted small">Crea una partida en el lobby para verla aquí.</p>
            ) : (
              <div className="matches">
                {matches.map((match) => {
                  const analysis = analyses[match.matchId]
                  const patterns =
                    analysis && analysis.status === 'analyzed' ? analysis.patterns ?? [] : []
                  return (
                    <article className="match-row" key={match.matchId}>
                      <div>
                        <strong>{match.title}</strong>
                        <p className="muted tiny">
                          <code>{match.matchId}</code> · {match.status}
                        </p>
                      </div>
                      <div className="analysis">
                        <span className={`pill small ${analysis?.status === 'analyzed' ? 'ok' : ''}`}>
                          {analysisLabel(analysis)}
                        </span>
                        {patterns.length > 0 ? (
                          <ul className="patterns">
                            {patterns.map((pattern) => (
                              <li key={`${pattern.type}-${pattern.playerId ?? 'x'}`}>
                                <strong>{pattern.type}</strong>
                                {pattern.detail ? `: ${pattern.detail}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : analysis?.status === 'analyzed' ? (
                          <span className="muted tiny">sin patrones detectados</span>
                        ) : null}
                      </div>
                      <a
                        className="ghost small"
                        href={`/api/matches/${encodeURIComponent(match.matchId)}/analysis`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        JSON
                      </a>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
