import { randomUUID } from 'node:crypto'
import type { AppData, NoteBody, NoteColor, NoteRecord, WindowBounds } from './types'
import { NOTE_COLORS } from './types'

export const DEFAULT_WIDTH = 306
export const DEFAULT_HEIGHT = 312
export const MIN_WIDTH = 260
export const MIN_HEIGHT = 240
export const LIST_DEFAULT_WIDTH = 322
export const LIST_DEFAULT_HEIGHT = 630

export const DEFAULT_DATA: AppData = {
  settings: {
    schemaVersion: 2,
    launchAtLogin: false,
    listBounds: null,
    isListVisible: true
  },
  notes: []
}

export function createNote(bounds: WindowBounds, color: NoteColor = 'yellow'): NoteRecord {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    body: createNoteBody(''),
    color,
    bounds,
    isAlwaysOnTop: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now
  }
}

export function createNoteBody(text: string): NoteBody {
  const textNode = text
    ? [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }]
    : []
  return {
    format: 'lexical-v1',
    plainText: text,
    state: JSON.stringify({
      root: {
        children: [
          {
            children: textNode,
            direction: null,
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: ''
          }
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1
      }
    })
  }
}

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && NOTE_COLORS.includes(value as NoteColor)
}

export function isValidNoteBody(value: unknown): value is NoteBody {
  if (!value || typeof value !== 'object') return false
  const body = value as Partial<NoteBody>
  if (body.format !== 'lexical-v1' || typeof body.state !== 'string' || typeof body.plainText !== 'string') {
    return false
  }
  try {
    const parsed = JSON.parse(body.state) as { root?: unknown }
    return Boolean(parsed.root)
  } catch {
    return false
  }
}

export function clampBounds(bounds: WindowBounds, workAreas: WindowBounds[]): WindowBounds {
  const fallback = workAreas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
  const width = Math.max(MIN_WIDTH, Math.min(bounds.width, fallback.width))
  const height = Math.max(MIN_HEIGHT, Math.min(bounds.height, fallback.height))

  const intersects = workAreas.find((area) => {
    const overlapWidth = Math.min(bounds.x + width, area.x + area.width) - Math.max(bounds.x, area.x)
    const overlapHeight = Math.min(bounds.y + height, area.y + area.height) - Math.max(bounds.y, area.y)
    return overlapWidth >= 80 && overlapHeight >= 40
  })

  if (intersects) {
    return {
      x: Math.max(intersects.x, Math.min(bounds.x, intersects.x + intersects.width - width)),
      y: Math.max(intersects.y, Math.min(bounds.y, intersects.y + intersects.height - height)),
      width: Math.min(width, intersects.width),
      height: Math.min(height, intersects.height)
    }
  }

  return {
    x: fallback.x + Math.max(0, Math.round((fallback.width - width) / 2)),
    y: fallback.y + Math.max(0, Math.round((fallback.height - height) / 2)),
    width,
    height
  }
}

export interface NormalizedData {
  data: AppData
  migrated: boolean
}

export function normalizeStoredData(value: unknown): NormalizedData | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (!candidate.settings || typeof candidate.settings !== 'object' || !Array.isArray(candidate.notes)) return null
  const settings = candidate.settings as Record<string, unknown>

  if (settings.schemaVersion === 2) {
    const notes = candidate.notes.filter(isValidNoteV2)
    return {
      migrated: false,
      data: {
        settings: {
          schemaVersion: 2,
          launchAtLogin: settings.launchAtLogin === true,
          listBounds: isValidBounds(settings.listBounds) ? settings.listBounds : null,
          isListVisible: settings.isListVisible !== false
        },
        notes
      }
    }
  }

  if (settings.schemaVersion === 1) {
    const notes = candidate.notes.flatMap((value) => {
      if (!isValidNoteV1(value)) return []
      return [{
        id: value.id,
        body: createNoteBody(value.content),
        color: value.color,
        bounds: value.bounds,
        isAlwaysOnTop: value.isAlwaysOnTop,
        isVisible: value.isVisible,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt
      } satisfies NoteRecord]
    })
    return {
      migrated: true,
      data: {
        settings: {
          schemaVersion: 2,
          launchAtLogin: settings.launchAtLogin === true,
          listBounds: null,
          isListVisible: true
        },
        notes
      }
    }
  }

  return null
}

export function normalizeData(value: unknown): AppData | null {
  return normalizeStoredData(value)?.data ?? null
}

function isValidNoteV2(value: unknown): value is NoteRecord {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<NoteRecord>
  return (
    typeof note.id === 'string' &&
    isValidNoteBody(note.body) &&
    isNoteColor(note.color) &&
    isValidBounds(note.bounds) &&
    typeof note.isAlwaysOnTop === 'boolean' &&
    typeof note.isVisible === 'boolean' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  )
}

interface NoteV1 {
  id: string
  content: string
  color: NoteColor
  bounds: WindowBounds
  isAlwaysOnTop: boolean
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

function isValidNoteV1(value: unknown): value is NoteV1 {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<NoteV1>
  return (
    typeof note.id === 'string' &&
    typeof note.content === 'string' &&
    isNoteColor(note.color) &&
    isValidBounds(note.bounds) &&
    typeof note.isAlwaysOnTop === 'boolean' &&
    typeof note.isVisible === 'boolean' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  )
}

function isValidBounds(value: unknown): value is WindowBounds {
  if (!value || typeof value !== 'object') return false
  const bounds = value as Partial<WindowBounds>
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    Number(bounds.width) > 0 &&
    Number(bounds.height) > 0
  )
}
