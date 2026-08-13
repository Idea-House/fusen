!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "保存した付箋データも削除しますか？$\r$\n「いいえ」を選ぶと、再インストール後もデータを利用できます。" IDNO keepFusenData
  RMDir /r "$APPDATA\ふせん"
  keepFusenData:
!macroend
