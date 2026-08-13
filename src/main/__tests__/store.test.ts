import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createNote, createNoteBody } from '../../shared/model'
import { NoteStore } from '../store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function createTemporaryStore(): Promise<{ directory: string; file: string; store: NoteStore }> {
  const directory = await mkdtemp(join(tmpdir(), 'fusen-test-'))
  temporaryDirectories.push(directory)
  const file = join(directory, 'notes.json')
  const store = new NoteStore(file)
  await store.initialize()
  return { directory, file, store }
}

describe('NoteStore', () => {
  it('persists note updates across reloads', async () => {
    const { file, store } = await createTemporaryStore()
    const note = createNote({ x: 40, y: 50, width: 300, height: 260 })
    await store.addNote(note)
    store.updateNoteDeferred(note.id, { body: createNoteBody('保存されるメモ') })
    await store.flush()

    const reloaded = new NoteStore(file)
    await reloaded.initialize()
    expect(reloaded.getNote(note.id)?.body.plainText).toBe('保存されるメモ')
  })

  it('recovers from the backup when the primary file is damaged', async () => {
    const { file, store } = await createTemporaryStore()
    const note = createNote({ x: 40, y: 50, width: 300, height: 260 })
    await store.addNote(note)
    await store.updateNote(note.id, { body: createNoteBody('バックアップ済み') })
    await writeFile(file, '{broken json', 'utf8')

    const recovered = new NoteStore(file)
    await recovered.initialize()
    expect(recovered.getNotes()).toHaveLength(1)
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty('settings.schemaVersion', 2)
  })

  it('keeps an intentionally empty note list after restart', async () => {
    const { file, store } = await createTemporaryStore()
    const note = createNote({ x: 40, y: 50, width: 300, height: 260 })
    await store.addNote(note)
    await store.deleteNote(note.id)

    const reloaded = new NoteStore(file)
    const result = await reloaded.initialize()
    expect(result.isFirstRun).toBe(false)
    expect(reloaded.getNotes()).toEqual([])
  })
})
