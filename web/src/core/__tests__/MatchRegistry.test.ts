import { describe, expect, it } from 'vitest'
import { MatchRegistry, REGISTRY_KEY } from '../MatchRegistry'
import type { MatchRecord } from '../types'
import { fakeStorage } from './helpers'

function record(matchId: string, updatedAt: string): MatchRecord {
  return {
    matchId,
    gameId: 'racing',
    title: 'Carrera por turnos',
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt,
    status: 'in_progress',
  }
}

describe('MatchRegistry', () => {
  it('guarda, actualiza y ordena por updatedAt', () => {
    const registry = new MatchRegistry(fakeStorage())
    registry.upsert(record('a', '2026-11-18T10:00:00.000Z'))
    registry.upsert(record('b', '2026-11-18T11:00:00.000Z'))
    expect(registry.list().map((r) => r.matchId)).toEqual(['b', 'a'])

    registry.update('b', { status: 'finished', winnerPlayerId: 'p-human' })
    expect(registry.get('b')).toMatchObject({ status: 'finished', winnerPlayerId: 'p-human' })
  })

  it('no rompe con JSON corrupto', () => {
    const storage = fakeStorage()
    storage.setItem(REGISTRY_KEY, '{no es json')
    const registry = new MatchRegistry(storage)
    expect(registry.list()).toEqual([])
  })

  it('elimina y limpia', () => {
    const registry = new MatchRegistry(fakeStorage())
    registry.upsert(record('a', '2026-11-18T10:00:00.000Z'))
    registry.remove('a')
    expect(registry.list()).toEqual([])
    registry.upsert(record('b', '2026-11-18T10:00:00.000Z'))
    registry.clear()
    expect(registry.list()).toEqual([])
  })
})
