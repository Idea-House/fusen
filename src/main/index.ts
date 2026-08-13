import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  Tray,
  type Rectangle
} from 'electron'
import {
  clampBounds,
  createNote,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  isNoteColor,
  isValidNoteBody,
  LIST_DEFAULT_HEIGHT,
  LIST_DEFAULT_WIDTH
} from '../shared/model'
import type { AppSettings, NotePatch, NoteRecord, WindowBounds } from '../shared/types'
import { NoteStore } from './store'

const APP_ID = 'jp.personal.fusen'
const NOTE_BACKGROUNDS: Record<NoteRecord['color'], { light: string; dark: string }> = {
  yellow: { light: '#fff39a', dark: '#303030' },
  green: { light: '#d7efbd', dark: '#303030' },
  rose: { light: '#f6c2dd', dark: '#303030' },
  lavender: { light: '#dbc0f3', dark: '#303030' },
  blue: { light: '#bfe8f7', dark: '#303030' },
  gray: { light: '#dedede', dark: '#303030' },
  charcoal: { light: '#5b5b5b', dark: '#303030' }
}

let store: NoteStore
let tray: Tray | null = null
let listWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let quitting = false
let shutdownStarted = false
let trayRefreshTimer: ReturnType<typeof setTimeout> | undefined
let notesChangedTimer: ReturnType<typeof setTimeout> | undefined
let listBoundsTimer: ReturnType<typeof setTimeout> | undefined
const noteWindows = new Map<string, BrowserWindow>()
const windowNoteIds = new Map<number, string>()
const deletingNotes = new Set<string>()
const boundsTimers = new Map<string, ReturnType<typeof setTimeout>>()

if (process.env.FUSEN_QA_USER_DATA) app.setPath('userData', process.env.FUSEN_QA_USER_DATA)

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.setAppUserModelId(APP_ID)
  app.on('second-instance', () => {
    if (app.isReady()) {
      void showListWindow()
      void createNewNote()
    }
  })

  app.on('before-quit', (event) => {
    if (!shutdownStarted) {
      event.preventDefault()
      void requestQuit()
    }
  })

  app.on('window-all-closed', () => {
    // The app intentionally remains available from the Windows notification area.
  })

  void app.whenReady().then(bootstrap)
}

async function bootstrap(): Promise<void> {
  store = new NoteStore(join(app.getPath('userData'), 'data', 'notes.json'))
  const { isFirstRun } = await store.initialize()
  registerIpcHandlers()
  createTray()
  syncLaunchAtLogin(store.getSettings())

  if (isFirstRun) await createNewNote()
  await showListWindow()

  if (!isFirstRun) {
    for (const note of store.getNotes().filter((item) => item.isVisible)) await showNote(note.id)
  }

  nativeTheme.on('updated', updateWindowBackgrounds)
  refreshTrayMenu()
  if (process.env.FUSEN_QA_OUTPUT_DIR) await runQaCapture(process.env.FUSEN_QA_OUTPUT_DIR)
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:ping', () => true)
  ipcMain.handle('note:get-current', (event) => {
    const noteId = getNoteIdForSender(event.sender.id)
    return noteId ? store.getNote(noteId) : null
  })

  ipcMain.on('note:set-body', (event, body: unknown) => {
    if (!isValidNoteBody(body)) return
    const noteId = getNoteIdForSender(event.sender.id)
    if (!noteId) return
    const safeBody = {
      ...body,
      state: body.state.slice(0, 2_000_000),
      plainText: body.plainText.slice(0, 200_000)
    }
    store.updateNoteDeferred(noteId, { body: safeBody })
    scheduleTrayRefresh()
    scheduleNotesChanged()
  })

  ipcMain.handle('note:update', async (event, patch: NotePatch) => {
    const noteId = getNoteIdForSender(event.sender.id)
    if (!noteId) return null
    const safePatch: NotePatch = {}
    if (isValidNoteBody(patch.body)) safePatch.body = patch.body
    if (isNoteColor(patch.color)) safePatch.color = patch.color
    if (typeof patch.isAlwaysOnTop === 'boolean') safePatch.isAlwaysOnTop = patch.isAlwaysOnTop

    const updated = await store.updateNote(noteId, safePatch)
    const noteWindow = noteWindows.get(noteId)
    if (updated && noteWindow) {
      noteWindow.setAlwaysOnTop(updated.isAlwaysOnTop)
      noteWindow.setBackgroundColor(getNoteBackground(updated.color))
      noteWindow.webContents.send('note:updated', updated)
    }
    notifyNotesChanged()
    refreshTrayMenu()
    return updated
  })

  ipcMain.handle('note:create', () => createNewNote())
  ipcMain.handle('note:hide-current', async (event) => {
    const noteId = getNoteIdForSender(event.sender.id)
    if (noteId) await hideNote(noteId)
  })
  ipcMain.handle('note:delete-current', async (event) => {
    const noteId = getNoteIdForSender(event.sender.id)
    if (noteId) await deleteNote(noteId)
  })
  ipcMain.handle('notes:list', () => getSortedNotes())
  ipcMain.handle('notes:show', (_event, noteId: unknown) => {
    if (typeof noteId === 'string') return showNote(noteId)
  })
  ipcMain.handle('notes:show-list', () => showListWindow())
  ipcMain.handle('notes:hide-list', () => hideListWindow())
  ipcMain.handle('notes:delete', (_event, noteId: unknown) => {
    if (typeof noteId === 'string') return deleteNote(noteId)
  })
  ipcMain.handle('settings:show', () => showSettingsWindow())
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>) => {
    const settings = await store.updateSettings({ launchAtLogin: patch.launchAtLogin === true })
    syncLaunchAtLogin(settings)
    return settings
  })
  ipcMain.handle('settings:close', () => settingsWindow?.close())
}

async function createNewNote(): Promise<NoteRecord> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const existingCount = store.getNotes().length
  const offset = (existingCount % 8) * 22
  const bounds = clampBounds(
    {
      x: display.workArea.x + Math.round((display.workArea.width - DEFAULT_WIDTH) / 2) - 90 + offset,
      y: display.workArea.y + Math.round((display.workArea.height - DEFAULT_HEIGHT) / 2) + offset,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT
    },
    getWorkAreas()
  )
  const note = await store.addNote(createNote(bounds))
  await showNote(note.id)
  notifyNotesChanged()
  refreshTrayMenu()
  return note
}

async function showNote(noteId: string): Promise<void> {
  const existingWindow = noteWindows.get(noteId)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show()
    existingWindow.focus()
    await store.updateNote(noteId, { isVisible: true })
    notifyNotesChanged()
    refreshTrayMenu()
    return
  }

  const note = store.getNote(noteId)
  if (!note) return
  const bounds = clampBounds(note.bounds, getWorkAreas())
  const noteWindow = new BrowserWindow({
    ...bounds,
    minWidth: 260,
    minHeight: 240,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    roundedCorners: true,
    backgroundColor: getNoteBackground(note.color),
    alwaysOnTop: note.isAlwaysOnTop,
    title: getNotePreview(note),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  noteWindows.set(noteId, noteWindow)
  const webContentsId = noteWindow.webContents.id
  windowNoteIds.set(webContentsId, noteId)
  await store.updateNote(noteId, { bounds, isVisible: true })
  noteWindow.once('ready-to-show', () => {
    noteWindow.show()
    noteWindow.focus()
  })
  await loadRenderer(noteWindow, { view: 'note', noteId })

  const scheduleBoundsCapture = (): void => {
    const previous = boundsTimers.get(noteId)
    if (previous) clearTimeout(previous)
    boundsTimers.set(noteId, setTimeout(() => {
      boundsTimers.delete(noteId)
      captureBounds(noteId)
    }, 250))
  }
  noteWindow.on('move', scheduleBoundsCapture)
  noteWindow.on('resize', scheduleBoundsCapture)
  noteWindow.on('close', (event) => {
    if (!quitting && !deletingNotes.has(noteId)) {
      event.preventDefault()
      void hideNote(noteId)
    }
  })
  noteWindow.on('closed', () => {
    const timer = boundsTimers.get(noteId)
    if (timer) clearTimeout(timer)
    boundsTimers.delete(noteId)
    windowNoteIds.delete(webContentsId)
    noteWindows.delete(noteId)
    deletingNotes.delete(noteId)
  })
}

async function showListWindow(): Promise<void> {
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.show()
    listWindow.focus()
    store.updateSettingsDeferred({ isListVisible: true })
    return
  }

  const bounds = getInitialListBounds()
  listWindow = new BrowserWindow({
    ...bounds,
    minWidth: 300,
    minHeight: 420,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    roundedCorners: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3',
    title: 'ふせん',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  store.updateSettingsDeferred({ listBounds: bounds, isListVisible: true })
  listWindow.once('ready-to-show', () => listWindow?.show())
  await loadRenderer(listWindow, { view: 'list' })

  const scheduleBoundsCapture = (): void => {
    if (listBoundsTimer) clearTimeout(listBoundsTimer)
    listBoundsTimer = setTimeout(() => {
      listBoundsTimer = undefined
      captureListBounds()
    }, 250)
  }
  listWindow.on('move', scheduleBoundsCapture)
  listWindow.on('resize', scheduleBoundsCapture)
  listWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      void hideListWindow()
    }
  })
  listWindow.on('closed', () => {
    listWindow = null
  })
}

async function hideListWindow(): Promise<void> {
  captureListBounds()
  listWindow?.hide()
  await store.updateSettings({ isListVisible: false })
}

async function hideNote(noteId: string): Promise<void> {
  captureBounds(noteId)
  noteWindows.get(noteId)?.hide()
  await store.updateNote(noteId, { isVisible: false })
  notifyNotesChanged()
  refreshTrayMenu()
}

async function deleteNote(noteId: string): Promise<void> {
  if (!store.getNote(noteId)) return
  deletingNotes.add(noteId)
  const noteWindow = noteWindows.get(noteId)
  if (noteWindow && !noteWindow.isDestroyed()) noteWindow.destroy()
  await store.deleteNote(noteId)
  notifyNotesChanged()
  refreshTrayMenu()
}

function captureBounds(noteId: string): void {
  const noteWindow = noteWindows.get(noteId)
  if (!noteWindow || noteWindow.isDestroyed() || noteWindow.isMinimized()) return
  store.updateNoteDeferred(noteId, { bounds: noteWindow.getBounds() })
}

function captureListBounds(): void {
  if (!listWindow || listWindow.isDestroyed() || listWindow.isMinimized()) return
  store.updateSettingsDeferred({ listBounds: listWindow.getBounds() })
}

function createTray(): void {
  const iconPath = app.isPackaged ? join(process.resourcesPath, 'tray.png') : join(process.cwd(), 'build', 'tray.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 })
  tray = new Tray(icon)
  tray.setToolTip('ふせん')
  tray.on('click', () => void showListWindow())
}

function refreshTrayMenu(): void {
  if (!tray) return
  const notes = getSortedNotes()
  const noteItems = notes.map((note) => ({
    label: `${note.isVisible ? '' : '○ '}${getNotePreview(note)}`,
    click: (): void => void showNote(note.id)
  }))
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '新しい付箋', accelerator: 'Ctrl+N', click: () => void createNewNote() },
    { label: 'メモの一覧', click: () => void showListWindow() },
    {
      label: '付箋を開く',
      enabled: noteItems.length > 0,
      submenu: noteItems.length > 0 ? noteItems : [{ label: '付箋はありません', enabled: false }]
    },
    { type: 'separator' },
    { label: '設定', click: () => void showSettingsWindow() },
    { type: 'separator' },
    { label: '終了', click: () => void requestQuit() }
  ]))
}

function scheduleTrayRefresh(): void {
  if (trayRefreshTimer) clearTimeout(trayRefreshTimer)
  trayRefreshTimer = setTimeout(() => {
    trayRefreshTimer = undefined
    refreshTrayMenu()
  }, 300)
}

function scheduleNotesChanged(): void {
  if (notesChangedTimer) clearTimeout(notesChangedTimer)
  notesChangedTimer = setTimeout(() => {
    notesChangedTimer = undefined
    notifyNotesChanged()
  }, 300)
}

function notifyNotesChanged(): void {
  if (listWindow && !listWindow.isDestroyed()) listWindow.webContents.send('notes:changed', getSortedNotes())
}

async function showSettingsWindow(): Promise<void> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 430,
    height: 320,
    minWidth: 430,
    minHeight: 320,
    resizable: false,
    autoHideMenuBar: true,
    title: 'ふせんの設定',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  await loadRenderer(settingsWindow, { view: 'settings' })
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

async function loadRenderer(window: BrowserWindow, query: Record<string, string>): Promise<void> {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (developmentUrl) {
    const url = new URL(developmentUrl)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    await window.loadURL(url.toString())
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

function getNoteIdForSender(webContentsId: number): string | undefined {
  return windowNoteIds.get(webContentsId)
}

function getSortedNotes(): NoteRecord[] {
  return [...store.getNotes()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getWorkAreas(): WindowBounds[] {
  return screen.getAllDisplays().map((display) => rectangleToBounds(display.workArea))
}

function rectangleToBounds(rectangle: Rectangle): WindowBounds {
  return { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height }
}

function getInitialListBounds(): WindowBounds {
  const saved = store.getSettings().listBounds
  if (saved) return clampBounds(saved, getWorkAreas())
  const display = screen.getPrimaryDisplay().workArea
  return {
    x: display.x + display.width - LIST_DEFAULT_WIDTH - 36,
    y: display.y + Math.max(32, Math.round((display.height - LIST_DEFAULT_HEIGHT) / 2)),
    width: LIST_DEFAULT_WIDTH,
    height: Math.min(LIST_DEFAULT_HEIGHT, display.height - 64)
  }
}

function getNotePreview(note: NoteRecord): string {
  const singleLine = note.body.plainText.replace(/\s+/gu, ' ').trim()
  return singleLine ? singleLine.slice(0, 32) : 'メモを作成する…'
}

function getNoteBackground(color: NoteRecord['color']): string {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return NOTE_BACKGROUNDS[color][theme]
}

function updateWindowBackgrounds(): void {
  for (const [noteId, window] of noteWindows) {
    const note = store.getNote(noteId)
    if (note && !window.isDestroyed()) window.setBackgroundColor(getNoteBackground(note.color))
  }
  const chromeBackground = nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3'
  if (listWindow && !listWindow.isDestroyed()) listWindow.setBackgroundColor(chromeBackground)
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.setBackgroundColor(chromeBackground)
}

function syncLaunchAtLogin(settings: AppSettings): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, path: process.execPath })
}

async function requestQuit(): Promise<void> {
  if (shutdownStarted) return
  shutdownStarted = true
  quitting = true
  for (const noteId of noteWindows.keys()) captureBounds(noteId)
  captureListBounds()
  if (store) await store.flush()
  tray?.destroy()
  app.quit()
}

async function runQaCapture(outputDirectory: string): Promise<void> {
  try {
    await delay(700)
    let note = getSortedNotes()[0]
    if (!note) note = await createNewNote()
    await showNote(note.id)
    await showListWindow()
    const noteWindow = noteWindows.get(note.id)
    if (!noteWindow || !listWindow) throw new Error('QA windows were not created')

    const restartOnly = process.env.FUSEN_QA_RESTART_ONLY === '1'
    const rendererResult = await noteWindow.webContents.executeJavaScript(`
      (async () => {
        const editor = document.querySelector('.note-editor');
        if (!(editor instanceof HTMLElement)) return { ready: false, reason: 'editor missing' };
        if (!${restartOnly ? 'true' : 'false'}) {
          editor.focus();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('insertText', false, '製品版 日本語入力テスト');
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        return {
          ready: Boolean(window.stickyNotes),
          text: editor.textContent,
          toolbarButtons: document.querySelectorAll('.format-button').length
        };
      })()
    `) as { ready: boolean; reason?: string; text?: string; toolbarButtons?: number }

    await delay(700)
    const savedNote = store.getNote(note.id)
    const result = {
      ...rendererResult,
      savedText: savedNote?.body.plainText ?? '',
      schemaVersion: store.getSettings().schemaVersion,
      listVisible: Boolean(listWindow?.isVisible()),
      restartVerified: restartOnly
    }
    if (!result.ready || !result.savedText.includes('製品版 日本語入力テスト')) {
      throw new Error(`Product input verification failed: ${JSON.stringify(result)}`)
    }

    await mkdir(outputDirectory, { recursive: true })
    const [noteImage, listImage] = await Promise.all([noteWindow.capturePage(), listWindow.capturePage()])
    await Promise.all([
      writeFile(join(outputDirectory, 'qa-note.png'), noteImage.toPNG()),
      writeFile(join(outputDirectory, 'qa-list.png'), listImage.toPNG()),
      writeFile(join(outputDirectory, 'qa-result.json'), JSON.stringify(result, null, 2), 'utf8')
    ])

    await noteWindow.webContents.executeJavaScript(`document.querySelector('[aria-label="その他"]')?.click()`)
    await delay(200)
    const menuImage = await noteWindow.capturePage()
    await writeFile(join(outputDirectory, 'qa-menu.png'), menuImage.toPNG())
    await store.flush()
    console.log(`FUSEN_QA_RESULT=${JSON.stringify(result)}`)
    await requestQuit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

process.on('uncaughtException', (error) => {
  dialog.showErrorBox('ふせんでエラーが発生しました', error.message)
})
