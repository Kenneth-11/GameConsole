import { useEffect, useState } from 'react'
import type { BaseGame } from '../core/BaseGame'
import { phaseLabel } from '../core/types'
import { EventLog } from './components/EventLog'
import { GameBoard } from './components/GameBoard'

interface Props {
  game: BaseGame
  onBack: () => void
  onDashboard: () => void
}

export function MatchView({ game, onBack, onDashboard }: Props) {
  const [, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    return game.subscribe(() => setVersion((version) => version + 1))
  }, [game])

  const snapshot = game.snapshot
  const finished = snapshot.phase === 'finished'
  const disabled = busy || snapshot.phase !== 'playing' || game.queueError !== null

  async function act(action: string, payload?: unknown) {
    setBusy(true)
    setActionError('')
    try {
      await game.play(action, payload)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <header className="match-head">
        <div>
          <button className="ghost" onClick={onBack}>
            ← Lobby
          </button>
          <h1>{game.title}</h1>
          <p className="muted small">
            Partida <code>{game.matchId}</code>
          </p>
        </div>
        <div className="match-meta">
          <span className={`pill ${finished ? 'ok' : ''}`}>
            {phaseLabel(snapshot.phase)}
          </span>
          <button className="ghost" onClick={onDashboard}>
            Ver panel
          </button>
        </div>
      </header>

      {actionError ? <p className="error">{actionError}</p> : null}
      {snapshot.errorMessage && snapshot.errorMessage !== actionError ? (
        <p className="error">{snapshot.errorMessage}</p>
      ) : null}
      {game.queueError ? <p className="error">{game.queueError.message}</p> : null}

      <div className="match-layout">
        <GameBoard snapshot={snapshot} disabled={disabled} onAction={act} />
        <EventLog events={game.eventLog} sent={game.sentCount} error={game.queueError} />
      </div>
    </section>
  )
}
