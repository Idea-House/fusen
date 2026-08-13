import type { StickyNotesApi } from '../../shared/types'

declare module '*.css'

declare global {
  interface Window {
    stickyNotes: StickyNotesApi
  }
}

export {}
