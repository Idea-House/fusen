import {
  Add20Regular,
  Checkmark16Regular,
  Delete20Regular,
  Dismiss20Regular,
  MoreHorizontal20Regular,
  Note20Regular,
  Pin20Regular
} from '@fluentui/react-icons'
import { useCallback, useEffect, useState } from 'react'
import { NOTE_COLORS, type NoteBody, type NoteColor, type NoteRecord } from '../../../shared/types'
import { RichNoteEditor } from './RichNoteEditor'

const COLOR_LABELS: Record<NoteColor, string> = {
  yellow: '黄色',
  green: '緑',
  rose: 'ピンク',
  lavender: '紫',
  blue: '青',
  gray: 'グレー',
  charcoal: 'チャコール'
}

export function NoteView(): React.JSX.Element {
  const [note, setNote] = useState<NoteRecord | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    void window.stickyNotes.getCurrentNote().then((currentNote) => {
      if (active) setNote(currentNote)
    })
    const unsubscribe = window.stickyNotes.onNoteUpdated((updated) => {
      if (active) setNote(updated)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void window.stickyNotes.createNote()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        void window.stickyNotes.hideCurrentNote()
      }
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const saveBody = useCallback((body: NoteBody): void => {
    window.stickyNotes.setBody(body)
  }, [])

  if (!note) return <main className="note-shell loading" aria-label="付箋を読み込んでいます" />

  const updateNote = async (patch: Partial<Pick<NoteRecord, 'color' | 'isAlwaysOnTop'>>): Promise<void> => {
    const updated = await window.stickyNotes.updateCurrentNote(patch)
    if (updated) setNote(updated)
  }

  const deleteNote = async (): Promise<void> => {
    if (window.confirm('このメモを削除しますか？\nこの操作は元に戻せません。')) {
      await window.stickyNotes.deleteCurrentNote()
    }
  }

  return (
    <main className="note-shell" data-color={note.color}>
      <header className="note-titlebar">
        <button type="button" className="titlebar-button" aria-label="新しいメモ" title="新しいメモ（Ctrl+N）" onClick={() => void window.stickyNotes.createNote()}>
          <Add20Regular aria-hidden="true" />
        </button>
        <span className="titlebar-drag" />
        <button type="button" className="titlebar-button" aria-label="その他" title="その他" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <MoreHorizontal20Regular aria-hidden="true" />
        </button>
        <button type="button" className="titlebar-button close-titlebar" aria-label="メモを閉じる" title="閉じる（Ctrl+W）" onClick={() => void window.stickyNotes.hideCurrentNote()}>
          <Dismiss20Regular aria-hidden="true" />
        </button>
      </header>

      {menuOpen ? (
        <>
          <button className="menu-scrim" type="button" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)} />
          <div className="note-menu" role="menu">
            <div className="color-strip" aria-label="メモの色">
              {NOTE_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className="color-choice"
                  data-swatch={color}
                  aria-label={COLOR_LABELS[color]}
                  title={COLOR_LABELS[color]}
                  onClick={() => {
                    setMenuOpen(false)
                    void updateNote({ color })
                  }}
                >
                  {note.color === color ? <Checkmark16Regular aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            <button type="button" role="menuitem" className="menu-item" onClick={() => {
              setMenuOpen(false)
              void window.stickyNotes.showNoteList()
            }}>
              <Note20Regular aria-hidden="true" />
              <span>メモの一覧</span>
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={note.isAlwaysOnTop} className="menu-item" onClick={() => void updateNote({ isAlwaysOnTop: !note.isAlwaysOnTop })}>
              <Pin20Regular aria-hidden="true" />
              <span>常に手前に表示</span>
              {note.isAlwaysOnTop ? <Checkmark16Regular className="menu-check" aria-hidden="true" /> : null}
            </button>
            <button type="button" role="menuitem" className="menu-item danger" onClick={() => void deleteNote()}>
              <Delete20Regular aria-hidden="true" />
              <span>メモの削除</span>
            </button>
          </div>
        </>
      ) : null}

      <RichNoteEditor key={note.id} body={note.body} onChange={saveBody} />
    </main>
  )
}
