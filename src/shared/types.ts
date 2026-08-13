export const NOTE_COLORS = ['yellow', 'green', 'rose', 'lavender', 'blue', 'gray', 'charcoal'] as const

export type NoteColor = (typeof NOTE_COLORS)[number]

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface NoteBody {
  format: 'lexical-v1'
  state: string
  plainText: string
}

export interface NoteRecord {
  id: string
  body: NoteBody
  color: NoteColor
  bounds: WindowBounds
  isAlwaysOnTop: boolean
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  schemaVersion: 2
  launchAtLogin: boolean
  listBounds: WindowBounds | null
  isListVisible: boolean
}

export interface AppData {
  settings: AppSettings
  notes: NoteRecord[]
}

export type NotePatch = Partial<Pick<NoteRecord, 'body' | 'color' | 'isAlwaysOnTop'>>

export interface StickyNotesApi {
  ping: () => Promise<boolean>
  getCurrentNote: () => Promise<NoteRecord | null>
  setBody: (body: NoteBody) => void
  updateCurrentNote: (patch: NotePatch) => Promise<NoteRecord | null>
  createNote: () => Promise<NoteRecord>
  hideCurrentNote: () => Promise<void>
  deleteCurrentNote: () => Promise<void>
  listNotes: () => Promise<NoteRecord[]>
  showNote: (noteId: string) => Promise<void>
  showNoteList: () => Promise<void>
  hideNoteList: () => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
  showSettings: () => Promise<void>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<Pick<AppSettings, 'launchAtLogin'>>) => Promise<AppSettings>
  closeSettings: () => Promise<void>
  onNoteUpdated: (listener: (note: NoteRecord) => void) => () => void
  onNotesChanged: (listener: (notes: NoteRecord[]) => void) => () => void
}
