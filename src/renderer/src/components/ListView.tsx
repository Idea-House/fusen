import { Add20Regular, Dismiss20Regular, Search20Regular, Settings20Regular } from '@fluentui/react-icons'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { NoteRecord } from '../../../shared/types'

export function ListView(): React.JSX.Element {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('ja-JP'))

  useEffect(() => {
    let active = true
    void window.stickyNotes.listNotes().then((items) => {
      if (active) setNotes(items)
    })
    const unsubscribe = window.stickyNotes.onNotesChanged((items) => {
      if (active) setNotes(items)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const filteredNotes = useMemo(() => {
    if (!deferredQuery) return notes
    return notes.filter((note) => note.body.plainText.toLocaleLowerCase('ja-JP').includes(deferredQuery))
  }, [deferredQuery, notes])

  return (
    <main className="list-shell">
      <header className="list-titlebar">
        <button type="button" className="chrome-button" aria-label="新しいメモ" title="新しいメモ" onClick={() => void window.stickyNotes.createNote()}>
          <Add20Regular aria-hidden="true" />
        </button>
        <span className="list-drag" />
        <button type="button" className="chrome-button" aria-label="設定" title="設定" onClick={() => void window.stickyNotes.showSettings()}>
          <Settings20Regular aria-hidden="true" />
        </button>
        <button type="button" className="chrome-button close-chrome" aria-label="一覧を閉じる" title="閉じる" onClick={() => void window.stickyNotes.hideNoteList()}>
          <Dismiss20Regular aria-hidden="true" />
        </button>
      </header>
      <div className="list-content">
        <h1>付箋</h1>
        <label className="search-field">
          <span className="sr-only">メモを検索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索…" />
          <Search20Regular aria-hidden="true" />
        </label>
        <section className="notes-list" aria-label="メモの一覧">
          {filteredNotes.length > 0 ? filteredNotes.map((note) => (
            <button
              type="button"
              key={note.id}
              className="note-card"
              data-color={note.color}
              onClick={() => void window.stickyNotes.showNote(note.id)}
            >
              <time dateTime={note.updatedAt}>{formatTime(note.updatedAt)}</time>
              <span className="note-preview">{note.body.plainText.trim() || 'メモを作成する…'}</span>
            </button>
          )) : (
            <div className="empty-list">
              <p>{notes.length === 0 ? 'メモはまだありません' : '一致するメモはありません'}</p>
              {notes.length === 0 ? (
                <button type="button" onClick={() => void window.stickyNotes.createNote()}>新しいメモを作成</button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function formatTime(value: string): string {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(date)
}
