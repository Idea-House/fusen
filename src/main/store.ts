import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppData, AppSettings, NotePatch, NoteRecord, WindowBounds } from '../shared/types'
import { DEFAULT_DATA, normalizeStoredData } from '../shared/model'

export class NoteStore {
  readonly filePath: string
  readonly backupPath: string
  private data: AppData = structuredClone(DEFAULT_DATA)
  private writeChain: Promise<void> = Promise.resolve()
  private saveTimer: ReturnType<typeof setTimeout> | undefined

  constructor(filePath: string) {
    this.filePath = filePath
    this.backupPath = `${filePath}.bak`
  }

  async initialize(): Promise<{ isFirstRun: boolean; migrated: boolean }> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const primary = await this.readValid(this.filePath)
    if (primary) {
      this.data = primary.data
      if (primary.migrated) await this.persistNow()
      return { isFirstRun: false, migrated: primary.migrated }
    }

    const backup = await this.readValid(this.backupPath)
    if (backup) {
      this.data = backup.data
      await this.persistNow()
      return { isFirstRun: false, migrated: backup.migrated }
    }

    const primaryExists = await fileExists(this.filePath)
    const backupExists = await fileExists(this.backupPath)
    this.data = structuredClone(DEFAULT_DATA)
    await this.persistNow()
    return { isFirstRun: !primaryExists && !backupExists, migrated: false }
  }

  getNotes(): NoteRecord[] {
    return this.data.notes.map((note) => structuredClone(note))
  }

  getNote(id: string): NoteRecord | null {
    const note = this.data.notes.find((item) => item.id === id)
    return note ? structuredClone(note) : null
  }

  async addNote(note: NoteRecord): Promise<NoteRecord> {
    this.data.notes.push(structuredClone(note))
    await this.persistNow()
    return structuredClone(note)
  }

  async updateNote(id: string, patch: NotePatch & { bounds?: WindowBounds; isVisible?: boolean }): Promise<NoteRecord | null> {
    const updated = this.applyNotePatch(id, patch)
    if (updated) await this.persistNow()
    return updated
  }

  updateNoteDeferred(id: string, patch: NotePatch & { bounds?: WindowBounds; isVisible?: boolean }): NoteRecord | null {
    const updated = this.applyNotePatch(id, patch)
    if (updated) this.scheduleSave()
    return updated
  }

  async deleteNote(id: string): Promise<void> {
    this.data.notes = this.data.notes.filter((note) => note.id !== id)
    await this.persistNow()
  }

  getSettings(): AppSettings {
    return structuredClone(this.data.settings)
  }

  async updateSettings(patch: Partial<Omit<AppSettings, 'schemaVersion'>>): Promise<AppSettings> {
    this.applySettingsPatch(patch)
    await this.persistNow()
    return this.getSettings()
  }

  updateSettingsDeferred(patch: Partial<Omit<AppSettings, 'schemaVersion'>>): AppSettings {
    this.applySettingsPatch(patch)
    this.scheduleSave()
    return this.getSettings()
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = undefined
      await this.persistNow()
    }
    await this.writeChain
  }

  private applyNotePatch(
    id: string,
    patch: NotePatch & { bounds?: WindowBounds; isVisible?: boolean }
  ): NoteRecord | null {
    const index = this.data.notes.findIndex((note) => note.id === id)
    if (index < 0) return null
    const existing = this.data.notes[index]
    if (!existing) return null
    const updated: NoteRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    }
    this.data.notes[index] = updated
    return structuredClone(updated)
  }

  private applySettingsPatch(patch: Partial<Omit<AppSettings, 'schemaVersion'>>): void {
    this.data.settings = { ...this.data.settings, ...patch, schemaVersion: 2 }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      void this.persistNow()
    }, 300)
  }

  private async persistNow(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2)
    const write = this.writeChain.catch(() => undefined).then(() => this.atomicWrite(snapshot))
    this.writeChain = write
    await write
  }

  private async atomicWrite(contents: string): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    const previousPath = `${this.filePath}.previous`
    await writeFile(temporaryPath, contents, 'utf8')
    await rm(previousPath, { force: true })

    if (await fileExists(this.filePath)) await rename(this.filePath, previousPath)
    try {
      await rename(temporaryPath, this.filePath)
      if (await fileExists(previousPath)) {
        await rm(this.backupPath, { force: true })
        await rename(previousPath, this.backupPath)
      }
    } catch (error) {
      if (await fileExists(previousPath)) await rename(previousPath, this.filePath)
      throw error
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }

  private async readValid(path: string): Promise<ReturnType<typeof normalizeStoredData>> {
    try {
      const contents = await readFile(path, 'utf8')
      return normalizeStoredData(JSON.parse(contents) as unknown)
    } catch {
      return null
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}
