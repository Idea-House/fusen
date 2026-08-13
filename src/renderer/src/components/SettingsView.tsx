import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'

export function SettingsView(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void window.stickyNotes.getSettings().then((current) => {
      if (active) setSettings(current)
    })
    return () => {
      active = false
    }
  }, [])

  const changeLaunchSetting = async (launchAtLogin: boolean): Promise<void> => {
    setSaving(true)
    try {
      const updated = await window.stickyNotes.updateSettings({ launchAtLogin })
      setSettings(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="settings-shell">
      <div>
        <p className="eyebrow">FUSEN</p>
        <h1>ふせんの設定</h1>
        <p className="settings-intro">小さなメモを、いつでもデスクトップのそばに。</p>
      </div>
      <section className="settings-card" aria-labelledby="startup-heading">
        <div>
          <h2 id="startup-heading">Windowsへのサインイン時</h2>
          <p>ふせんを自動で起動し、前回表示していたメモを復元します。</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings?.launchAtLogin ?? false}
            disabled={!settings || saving}
            onChange={(event) => void changeLaunchSetting(event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
          <span className="sr-only">自動起動を有効にする</span>
        </label>
      </section>
      <footer className="settings-footer">
        <p>付箋の内容はこのPCだけに保存されます。</p>
        <button type="button" onClick={() => void window.stickyNotes.closeSettings()}>
          閉じる
        </button>
      </footer>
    </main>
  )
}
