# リバースプロキシ設定機能 - 実装引継資料

## ステータス
**✅ コア実装完了**

## 目的
各AIプロバイダー（Claude, OpenRouter, Gemini, Ollama, OpenAI互換）にリバースプロキシを設定できるオプションを追加する。Bearer認証をサポート。

---

## 完了済み作業

### 1. 仕様ドキュメント作成
- `docs/reverse-proxy-settings.md` - 設計仕様書

### 2. フォーク運用ルール策定
- `CLAUDE.local.md` - フォークメンテナンスルール
- `.gitattributes` - マージ保護設定

### 3. カスタムモジュール構造作成 ✅
```
src/app/custom/
├── models/
│   └── proxy-settings.interface.ts
├── services/
│   ├── proxy-settings.service.ts      ✅ 設定管理
│   ├── claude-api-proxy.service.ts    ✅ Claude API プロキシ対応
│   ├── openrouter-api-proxy.service.ts ✅ OpenRouter プロキシ対応
│   ├── gemini-api-proxy.service.ts    ✅ Gemini プロキシ対応
│   ├── ollama-api-proxy.service.ts    ✅ Ollama 認証対応
│   └── openai-api-proxy.service.ts    ✅ OpenAI互換 認証対応
├── components/
│   └── proxy-settings/                ✅ 設定UI
└── custom.module.ts                   ✅ DI設定
```

### 4. DI設定完了 ✅
- `custom.module.ts`で親クラスをプロキシサービスに差し替え
- `app.config.ts`でCustomModuleをインポート

### 5. 設定UI統合 ✅
- 設定画面に「Proxy」タブを追加
- 各プロバイダーのプロキシURL/認証トークン設定が可能

---

## 方針変更の経緯

### 当初のアプローチ（却下）
upstreamファイルを直接修正：
- `src/app/core/models/settings.interface.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/claude-api.service.ts`
- 他のAPIサービス

**問題点**: CLAUDE.local.mdのフォークルールに違反。upstream同期時にコンフリクト発生。

### 正しいアプローチ（採用）
`src/app/custom/` 配下にカスタム実装を作成し、DIで差し替え。

---

## 残りの作業（オプション）

### テスト接続機能
- 各プロキシサービスに`testProxyConnection()`メソッドを追加
- UIに「Test Connection」ボタンを追加
- 接続成功/失敗のフィードバック表示

### 単体テスト
- `proxy-settings.service.spec.ts`
- 各プロキシサービスのspec.tsファイル

### E2Eテスト
- 実際のプロキシサーバーを用意してテスト

---

## 設計ポイント

### プロキシ認証
- Claude/Gemini: `Authorization: Bearer {token}` を追加
- OpenRouter: 元々Bearerを使用 → `X-Proxy-Auth: Bearer {token}` で分離
- Ollama/OpenAI互換: 既存baseURLに認証ヘッダー追加

### 設定の分離
- プロキシ設定は独自のlocalStorageキーに保存
- upstreamの設定構造には手を加えない

### 継承パターン
- 元のAPIサービスを`extends`で継承
- 必要なメソッドのみオーバーライド
- 既存の動作を維持

---

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `docs/reverse-proxy-settings.md` | 仕様ドキュメント |
| `CLAUDE.local.md` | フォークルール |
| `.gitattributes` | マージ保護 |
| `src/app/core/services/claude-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/openrouter-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/google-gemini-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/ollama-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/openai-compatible-api.service.ts` | 継承元（参照用） |

---

## 注意事項

1. **upstreamファイルは変更しない** - CLAUDE.local.mdのルールを厳守
2. **カスタムコードは`src/app/custom/`に配置** - `.gitattributes`で保護済み
3. **DI差し替えはCustomModuleで行う** - app.config.tsへの変更は最小限に
