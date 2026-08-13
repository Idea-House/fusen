import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, NoteBody, NotePatch, NoteRecord, StickyNotesApi } from '../shared/types'

const api: StickyNotesApi = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<boolean>,
  getCurrentNote: () => ipcRenderer.invoke('note:get-current') as Promise<NoteRecord | null>,
  setBody: (body: NoteBody) => ipcRenderer.send('note:set-body', body),
  updateCurrentNote: (patch: NotePatch) => ipcRenderer.invoke('note:update', patch) as Promise<NoteRecord | null>,
  createNote: () => ipcRenderer.invoke('note:create') as Promise<NoteRecord>,
  hideCurrentNote: () => ipcRenderer.invoke('note:hide-current') as Promise<void>,
  deleteCurrentNote: () => ipcRenderer.invoke('note:delete-current') as Promise<void>,
  listNotes: () => ipcRenderer.invoke('notes:list') as Promise<NoteRecord[]>,
  showNote: (noteId) => ipcRenderer.invoke('notes:show', noteId) as Promise<void>,
  showNoteList: () => ipcRenderer.invoke('notes:show-list') as Promise<void>,
  hideNoteList: () => ipcRenderer.invoke('notes:hide-list') as Promise<void>,
  deleteNote: (noteId) => ipcRenderer.invoke('notes:delete', noteId) as Promise<void>,
  showSettings: () => ipcRenderer.invoke('settings:show') as Promise<void>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch) as Promise<AppSettings>,
  closeSettings: () => ipcRenderer.invoke('settings:close') as Promise<void>,
  onNoteUpdated: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, note: NoteRecord): void => listener(note)
    ipcRenderer.on('note:updated', wrapped)
    return () => ipcRenderer.removeListener('note:updated', wrapped)
  },
  onNotesChanged: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, notes: NoteRecord[]): void => listener(notes)
    ipcRenderer.on('notes:changed', wrapped)
    return () => ipcRenderer.removeListener('notes:changed', wrapped)
  }
}

contextBridge.exposeInMainWorld('stickyNotes', api)
