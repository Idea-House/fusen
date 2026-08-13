import { describe, expect, it } from 'vitest'
import { clampBounds, normalizeData, normalizeStoredData } from '../../shared/model'

describe('clampBounds', () => {
  it('keeps an on-screen note in place', () => {
    expect(
      clampBounds(
        { x: 100, y: 120, width: 300, height: 260 },
        [{ x: 0, y: 0, width: 1920, height: 1040 }]
      )
    ).toEqual({ x: 100, y: 120, width: 300, height: 260 })
  })

  it('moves a note from a disconnected display to the primary display', () => {
    expect(
      clampBounds(
        { x: 2600, y: 200, width: 300, height: 260 },
        [{ x: 0, y: 0, width: 1920, height: 1040 }]
      )
    ).toEqual({ x: 810, y: 390, width: 300, height: 260 })
  })

  it('enforces the minimum note size', () => {
    expect(
      clampBounds(
        { x: 20, y: 20, width: 100, height: 100 },
        [{ x: 0, y: 0, width: 1280, height: 720 }]
      )
    ).toMatchObject({ width: 260, height: 240 })
  })
})

describe('normalizeData', () => {
  it('rejects unsupported schemas', () => {
    expect(normalizeData({ settings: { schemaVersion: 3 }, notes: [] })).toBeNull()
  })

  it('migrates schema v1 settings to schema v2', () => {
    const normalized = normalizeStoredData({ settings: { schemaVersion: 1, launchAtLogin: 'yes' }, notes: [] })
    expect(normalized?.migrated).toBe(true)
    expect(normalized?.data.settings).toEqual({
      schemaVersion: 2,
      launchAtLogin: false,
      listBounds: null,
      isListVisible: true
    })
  })

  it('preserves schema v1 note text during migration', () => {
    const value = {
      settings: { schemaVersion: 1, launchAtLogin: true },
      notes: [{
        id: 'legacy-note',
        content: '以前のメモ',
        color: 'yellow',
        bounds: { x: 10, y: 20, width: 300, height: 260 },
        isAlwaysOnTop: false,
        isVisible: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }]
    }
    const normalized = normalizeStoredData(value)
    expect(normalized?.data.notes[0]?.body.plainText).toBe('以前のメモ')
    expect(normalized?.data.notes[0]?.id).toBe('legacy-note')
  })
})
