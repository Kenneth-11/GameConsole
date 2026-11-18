import type { GameEvent } from '../../core/types'

interface Props {
  events: readonly GameEvent[]
  sent: number
  error: Error | null
}

function timeOf(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleTimeString('es-CR', { hour12: false })
}

export function EventLog({ events, sent, error }: Props) {
  const pending = events.length - sent
  const recent = [...events].slice(-14).reverse()

  return (
    <aside className="panel event-log">
      <div className="panel-head">
        <h3>Eventos enviados</h3>
        <span className="pill small">
          {sent}/{events.length} {pending > 0 ? `· ${pending} en cola` : ''}
        </span>
      </div>
      {error ? <p className="error">{error.message}</p> : null}
      {recent.length === 0 ? (
        <p className="muted small">La cola está vacía.</p>
      ) : (
        <ul>
          {recent.map((event) => (
            <li key={event.eventId}>
              <span className="event-time">{timeOf(event.timestamp)}</span>
              <span className={`event-type ${event.type === 'MATCH_FINISHED' ? 'finish' : ''}`}>
                {event.type}
              </span>
              <span className="muted small">
                {event.playerId || 'sistema'}
                {event.action ? ` · ${event.action}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted tiny">
        Envío FIFO por partida. Un 422 de duplicado se considera entregado.
      </p>
    </aside>
  )
}
