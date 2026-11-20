import type { MatchRecord } from './types'

export const REGISTRY_KEY = 'gameconsole.matches.v1'
const RECORD_PREFIX = `${REGISTRY_KEY}.record.`

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys?(): string[]
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
    keys: () => [...data.keys()],
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

function storageKeys(storage: StorageLike): string[] {
  if (storage.keys) {
    return storage.keys()
  }
  if (typeof window !== 'undefined' && storage === window.localStorage) {
    const keys: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key) {
        keys.push(key)
      }
    }
    return keys
  }
  return []
}

function parseRecord(raw: string | null): MatchRecord | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MatchRecord> | null
    if (!parsed || typeof parsed.matchId !== 'string' || typeof parsed.updatedAt !== 'string') {
      return null
    }
    return parsed as MatchRecord
  } catch {
    return null
  }
}

export class MatchRegistry {
  private readonly storage: StorageLike

  constructor(storage: StorageLike = defaultStorage()) {
    this.storage = storage
  }

  list(): MatchRecord[] {
    const records = new Map<string, MatchRecord>()
    const legacyRaw = this.storage.getItem(REGISTRY_KEY)
    const legacyRecord = parseRecord(legacyRaw)
    if (legacyRecord) {
      records.set(legacyRecord.matchId, legacyRecord)
    } else if (legacyRaw) {
      try {
        const parsed = JSON.parse(legacyRaw) as unknown
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item.matchId === 'string' && typeof item.updatedAt === 'string') {
              records.set(item.matchId, item as MatchRecord)
            }
          }
        }
      } catch {
        // Registro legado corrupto: se ignora y se conservan las claves por partida.
      }
    }

    for (const key of storageKeys(this.storage)) {
      if (!key.startsWith(RECORD_PREFIX)) {
        continue
      }
      const record = parseRecord(this.storage.getItem(key))
      if (!record) {
        continue
      }
      const current = records.get(record.matchId)
      if (!current || record.updatedAt >= current.updatedAt) {
        records.set(record.matchId, record)
      }
    }

    return [...records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  get(matchId: string): MatchRecord | undefined {
    return this.list().find((record) => record.matchId === matchId)
  }

  upsert(record: MatchRecord): void {
    this.writeRecord(record)
    const rest = this.list().filter((item) => item.matchId !== record.matchId)
    this.write([record, ...rest])
  }

  update(matchId: string, patch: Partial<MatchRecord>): void {
    const records = this.list()
    const index = records.findIndex((item) => item.matchId === matchId)
    if (index < 0) {
      return
    }
    const updated = { ...records[index], ...patch }
    records[index] = updated
    this.writeRecord(updated)
    this.write(records)
  }

  remove(matchId: string): void {
    this.storage.removeItem(`${RECORD_PREFIX}${matchId}`)
    this.write(this.list().filter((item) => item.matchId !== matchId))
  }

  clear(): void {
    for (const key of storageKeys(this.storage)) {
      if (key === REGISTRY_KEY || key.startsWith(RECORD_PREFIX)) {
        this.storage.removeItem(key)
      }
    }
    this.storage.removeItem(REGISTRY_KEY)
  }

  private write(records: MatchRecord[]): void {
    try {
      this.storage.setItem(REGISTRY_KEY, JSON.stringify(records))
    } catch {
      // Cuota o almacenamiento bloqueado: la partida sigue en memoria.
    }
  }

  private writeRecord(record: MatchRecord): void {
    try {
      this.storage.setItem(`${RECORD_PREFIX}${record.matchId}`, JSON.stringify(record))
    } catch {
      // Cuota o almacenamiento bloqueado: se conserva el arreglo principal.
    }
  }
}
