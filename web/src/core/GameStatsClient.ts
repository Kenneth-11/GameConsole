import type { AnalysisResponse, GameEvent, StatsResponse } from './types'

export class GameStatsError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`GameStats respondió ${status}: ${body || 'sin detalle'}`)
    this.name = 'GameStatsError'
    this.status = status
    this.body = body
  }
}

export class GameStatsClient {
  readonly baseUrl: string

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(8000),
      })
    } catch (error) {
      throw new GameStatsError(0, `no se pudo contactar GameStats (${String(error)})`)
    }
  }

  async sendEvent(event: GameEvent): Promise<void> {
    const res = await this.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    const body = await res.text()
    if (res.status === 202 || res.status === 200) {
      return
    }
    // GameStats deduplica por eventId de forma global: un duplicado ya está entregado.
    if (res.status === 422 && /duplicad/i.test(body)) {
      return
    }
    throw new GameStatsError(res.status, body)
  }

  async getStats(): Promise<StatsResponse> {
    const res = await this.request('/stats')
    if (!res.ok) {
      throw new GameStatsError(res.status, await res.text())
    }
    return (await res.json()) as StatsResponse
  }

  async getAnalysis(matchId: string): Promise<AnalysisResponse> {
    const res = await this.request(`/matches/${encodeURIComponent(matchId)}/analysis`)
    if (res.status === 202) {
      return { status: 'pending' }
    }
    if (!res.ok) {
      throw new GameStatsError(res.status, await res.text())
    }
    return (await res.json()) as AnalysisResponse
  }

  async health(): Promise<boolean> {
    try {
      const res = await this.request('/health')
      return res.ok
    } catch {
      return false
    }
  }
}
