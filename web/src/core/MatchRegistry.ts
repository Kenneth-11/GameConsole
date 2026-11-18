import type { MatchRecord } from './types'

export const REGISTRY_KEY = 'gameconsole.matches.v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

function defaultStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.getItem(REGISTRY_KEY)
      return window.localStorage
    }
  } catch {
    // localStorage bloqueado: se usa memoria para no romper la partida.
  }
  return memoryStorage()
}

export class MatchRegistry {
  private readonly storage: StorageLike

  constructor(storage: StorageLike = defaultStorage()) {
    this.storage = storage
  }

  list(): MatchRecord[] {
    const raw = this.storage.getItem(REGISTRY_KEY)
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }
      return (parsed as MatchRecord[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch {
      return []
    }
  }

  get(matchId: string): MatchRecord | undefined {
    return this.list().find((record) => record.matchId === matchId)
  }

  upsert(record: MatchRecord): void {
    const rest = this.list().filter((item) => item.matchId !== record.matchId)
    this.write([record, ...rest])
  }

  update(matchId: string, patch: Partial<MatchRecord>): void {
    const records = this.list()
    const index = records.findIndex((item) => item.matchId === matchId)
    if (index < 0) {
      return
    }
    records[index] = { ...records[index], ...patch }
    this.write(records)
  }

  remove(matchId: string): void {
    this.write(this.list().filter((item) => item.matchId !== matchId))
  }

  clear(): void {
    this.storage.removeItem(REGISTRY_KEY)
  }

  private write(records: MatchRecord[]): void {
    try {
      this.storage.setItem(REGISTRY_KEY, JSON.stringify(records))
    } catch {
      // Cuota o almacenamiento bloqueado: la partida sigue en memoria.
    }
  }
}
