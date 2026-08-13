# ふせん

Windows 10/11向けの、通知領域に常駐する軽量な付箋アプリです。付箋の本文・色・位置・サイズは現在のWindowsユーザーの領域へ自動保存されます。

Windows 11の付箋に馴染む個別メモと一覧画面、検索、7色の配色、太字・斜体・下線・取り消し線・箇条書きに対応しています。Windowsのライト／ダーク設定へ自動で追従します。

## 開発

```powershell
npm install
npm run dev
```

## 検証

```powershell
npm run typecheck
npm test
npm run build
npm run test:product
```

## Windows配布物

```powershell
npm run dist
```

`release`フォルダにWindows x64用インストーラーとポータブル版が生成されます。個人利用向けのため、コード署名と自動更新は含まれていません。
