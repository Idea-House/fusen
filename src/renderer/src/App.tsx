import { useEffect, useState } from 'react'
import { ListView } from './components/ListView'
import { NoteView } from './components/NoteView'
import { SettingsView } from './components/SettingsView'

type BridgeState = 'checking' | 'ready' | 'failed'

export function App(): React.JSX.Element {
  const [bridgeState, setBridgeState] = useState<BridgeState>('checking')

  useEffect(() => {
    if (!window.stickyNotes) {
      setBridgeState('failed')
      return
    }
    void window.stickyNotes.ping()
      .then((ready) => setBridgeState(ready ? 'ready' : 'failed'))
      .catch(() => setBridgeState('failed'))
  }, [])

  if (bridgeState === 'checking') return <main className="bridge-state" aria-label="起動しています" />
  if (bridgeState === 'failed') return <BridgeFailure />

  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'settings') return <SettingsView />
  if (view === 'list') return <ListView />
  return <NoteView />
}

function BridgeFailure(): React.JSX.Element {
  return (
    <main className="bridge-failure" role="alert">
      <h1>ふせんを起動できませんでした</h1>
      <p>アプリを終了して、もう一度起動してください。</p>
    </main>
  )
}
