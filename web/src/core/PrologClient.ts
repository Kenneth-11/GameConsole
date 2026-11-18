export interface PrologDecision {
  column: number
  score: number
  depth: number
  nodes: number
  ms: number
}

export class PrologError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(`IA Prolog: ${message}`)
    this.name = 'PrologError'
    this.status = status
  }
}

export class PrologClient {
  readonly baseUrl: string

  constructor(baseUrl = '/prolog') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(4000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async decide(board: number[][], player: 1 | 2, depth: number): Promise<PrologDecision> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, player, depth }),
        signal: AbortSignal.timeout(15000),
      })
    } catch (error) {
      throw new PrologError(0, `no se pudo contactar el servicio (${String(error)})`)
    }
    const body = await res.text()
    if (!res.ok) {
      throw new PrologError(res.status, body || res.statusText)
    }
    const parsed = JSON.parse(body) as Partial<PrologDecision> & { message?: string }
    if (typeof parsed.column !== 'number' || parsed.column < 1 || parsed.column > 7) {
      throw new PrologError(500, parsed.message ?? 'respuesta sin columna válida')
    }
    return {
      column: parsed.column,
      score: Number(parsed.score ?? 0),
      depth: Number(parsed.depth ?? depth),
      nodes: Number(parsed.nodes ?? 0),
      ms: Number(parsed.ms ?? 0),
    }
  }
}
