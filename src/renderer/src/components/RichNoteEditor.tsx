import { INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode, REMOVE_LIST_COMMAND, $isListNode } from '@lexical/list'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextItalic20Regular,
  TextStrikethrough20Regular,
  TextUnderline20Regular
} from '@fluentui/react-icons'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type TextFormatType
} from 'lexical'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NoteBody } from '../../../shared/types'

interface RichNoteEditorProps {
  body: NoteBody
  onChange: (body: NoteBody) => void
}

export function RichNoteEditor({ body, onChange }: RichNoteEditorProps): React.JSX.Element {
  const initialConfig = useMemo(() => ({
    namespace: 'FusenEditor',
    editorState: body.state,
    nodes: [ListNode, ListItemNode],
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-bold',
        italic: 'editor-italic',
        underline: 'editor-underline',
        strikethrough: 'editor-strikethrough',
        underlineStrikethrough: 'editor-underline-strikethrough'
      },
      list: {
        ul: 'editor-list',
        listitem: 'editor-list-item'
      }
    },
    onError: (error: Error) => {
      throw error
    }
  }), [body.state])

  const handleChange = useCallback((editorState: EditorState): void => {
    let plainText = ''
    editorState.read(() => {
      plainText = $getRoot().getTextContent()
    })
    onChange({ format: 'lexical-v1', state: JSON.stringify(editorState), plainText })
  }, [onChange])

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-area">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="note-editor"
              aria-placeholder="メモを作成する…"
              placeholder={<div className="editor-placeholder">メモを作成する…</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <AutoFocusPlugin defaultSelection="rootEnd" />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </div>
      <EditorToolbar />
    </LexicalComposer>
  )
}

function EditorToolbar(): React.JSX.Element {
  const [editor] = useLexicalComposerContext()
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(() => new Set())
  const [isBulletList, setIsBulletList] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const formats = new Set<TextFormatType>()
    for (const format of ['bold', 'italic', 'underline', 'strikethrough'] as const) {
      if (selection.hasFormat(format)) formats.add(format)
    }
    setActiveFormats(formats)
    const anchorNode = selection.anchor.getNode()
    const topLevel = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
    setIsBulletList($isListNode(topLevel) && topLevel.getListType() === 'bullet')
  }, [])

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => editorState.read(updateToolbar))
    const unregisterSelection = editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      updateToolbar()
      return false
    }, COMMAND_PRIORITY_LOW)
    const unregisterCanUndo = editor.registerCommand(CAN_UNDO_COMMAND, (value) => {
      setCanUndo(value)
      return false
    }, COMMAND_PRIORITY_LOW)
    const unregisterCanRedo = editor.registerCommand(CAN_REDO_COMMAND, (value) => {
      setCanRedo(value)
      return false
    }, COMMAND_PRIORITY_LOW)
    return () => {
      unregisterUpdate()
      unregisterSelection()
      unregisterCanUndo()
      unregisterCanRedo()
    }
  }, [editor, updateToolbar])

  const formatButton = (
    format: TextFormatType,
    label: string,
    Icon: typeof TextBold20Regular
  ): React.JSX.Element => (
    <button
      type="button"
      className={`format-button${activeFormats.has(format) ? ' active' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={activeFormats.has(format)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
    >
      <Icon aria-hidden="true" />
    </button>
  )

  return (
    <footer className="format-toolbar" aria-label="文字の書式">
      {formatButton('bold', '太字', TextBold20Regular)}
      {formatButton('italic', '斜体', TextItalic20Regular)}
      {formatButton('underline', '下線', TextUnderline20Regular)}
      {formatButton('strikethrough', '取り消し線', TextStrikethrough20Regular)}
      <button
        type="button"
        className={`format-button${isBulletList ? ' active' : ''}`}
        aria-label="箇条書き"
        title="箇条書き"
        aria-pressed={isBulletList}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.dispatchCommand(isBulletList ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <TextBulletListLtr20Regular aria-hidden="true" />
      </button>
      <span className="format-spacer" />
      <button
        type="button"
        className="format-button history-button"
        aria-label="元に戻す"
        title="元に戻す（Ctrl+Z）"
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <ArrowUndo20Regular aria-hidden="true" />
      </button>
      <button
        type="button"
        className="format-button history-button"
        aria-label="やり直す"
        title="やり直す（Ctrl+Y）"
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <ArrowRedo20Regular aria-hidden="true" />
      </button>
    </footer>
  )
}
