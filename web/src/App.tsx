import { useMemo, useState } from 'react'
import type { BaseGame } from './core/BaseGame'
import { createGame } from './core/games'
import { GameStatsClient } from './core/GameStatsClient'
import { MatchRegistry } from './core/MatchRegistry'
import { PrologClient } from './core/PrologClient'
import type { GameId } from './core/types'
import { Dashboard } from './ui/Dashboard'
import { Lobby } from './ui/Lobby'
import { MatchView } from './ui/MatchView'

type View = 'lobby' | 'match' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('lobby')
  const [games, setGames] = useState<BaseGame[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const activeGame = games.find((item) => item.matchId === activeId) ?? null

  const deps = useMemo(
    () => ({
      stats: new GameStatsClient(),
      prolog: new PrologClient(),
      registry: new MatchRegistry(),
    }),
    [],
  )

  async function handleCreate(gameId: GameId, depth: number) {
    setStarting(true)
    setStartError('')
    try {
      const next = createGame(gameId, deps, { connect4Depth: depth })
      await next.start()
      setGames((current) => [next, ...current.filter((item) => item.matchId !== next.matchId)])
      setActiveId(next.matchId)
      setView('match')
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  function openDashboard() {
    setView('dashboard')
  }

  function openGame(matchId: string) {
    setActiveId(matchId)
    setView('match')
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView('lobby')}>
          <span className="logo">GC</span>
          <span>
            GameConsole
            <small>eventos → GameStats</small>
          </span>
        </button>
        <nav>
          <button
            className={view === 'lobby' ? 'active' : ''}
            onClick={() => setView('lobby')}
          >
            Lobby
          </button>
          <button
            className={view === 'match' ? 'active' : ''}
            disabled={!activeGame}
            onClick={() => setView('match')}
          >
            Partida
          </button>
          <button
            className={view === 'dashboard' ? 'active' : ''}
            onClick={openDashboard}
          >
            Panel
          </button>
        </nav>
      </header>

      <main>
        {view === 'lobby' ? (
          <Lobby
            starting={starting}
            error={startError}
            onCreate={handleCreate}
            sessions={games}
            onOpen={openGame}
          />
        ) : null}
        {view === 'match' && activeGame ? (
          <MatchView
            game={activeGame}
            onBack={() => setView('lobby')}
            onDashboard={openDashboard}
          />
        ) : null}
        {view === 'dashboard' ? <Dashboard /> : null}
      </main>

      <footer className="footer">
        <span>GameConsole · Vite + React + TypeScript</span>
        <span>GameStats: Go + Scala · IA: SWI-Prolog</span>
      </footer>
    </div>
  )
}
