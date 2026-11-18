import type { GameEvent } from './types'
import type { GameStatsClient } from './GameStatsClient'

export class EventQueue {
  private tail: Promise<void> = Promise.resolve()
  private failure: Error | null = null
  private sent = 0
  private readonly client: GameStatsClient

  constructor(client: GameStatsClient) {
    this.client = client
  }

  get sentCount(): number {
    return this.sent
  }

  get failed(): Error | null {
    return this.failure
  }

  enqueue(event: GameEvent): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure)
    }
    const send = this.tail.then(async () => {
      await this.client.sendEvent(event)
      this.sent += 1
    })
    this.tail = send.catch((error: unknown) => {
      if (!this.failure) {
        this.failure = error instanceof Error ? error : new Error(String(error))
      }
    })
    return send
  }
}
