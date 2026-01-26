# Fork Maintenance Rules (Overwrite Upstream)

## Core Principles for Forking
- **Extension over Modification**: Do NOT modify existing upstream files unless absolutely necessary for bug fixes.
- **Isolation**: All custom logic MUST reside in the `src/app/custom/` directory (or equivalent isolated module).
- **Wrapper Pattern**: Instead of changing function `A` in `file.ts`, create `file_custom.ts`, import `A`, and wrap it in a new function.

## Coding Style for Conflict Avoidance
- **Inheritance**: If a class behavior needs changing, extend the class in a new file rather than editing the original class.
- **Configuration**: Use configuration files or dependency injection to swap implementations, avoiding hard-coded changes in upstream files.
- **No Deletions**: Do not delete or rename upstream functions/variables as other upstream parts may depend on them in future updates.

## File Placement
- New features -> `src/app/custom/features/`
- Overrides -> `src/app/custom/overrides/`
- Tests for custom code -> colocate as `*.spec.ts` files (e.g., `src/app/custom/features/my-feature/my-feature.service.spec.ts`)

## Angular Integration
- Create `src/app/custom/custom.module.ts` to encapsulate all custom functionality
- Use Angular's Dependency Injection to swap upstream implementations:
  ```typescript
  // In custom.module.ts
  providers: [
    { provide: UpstreamService, useClass: CustomService }
  ]
  ```
- For lazy loading, register custom routes in `custom-routing.module.ts`
- Avoid modifying `app.routes.ts` directly; instead, import custom routes dynamically

## Upstream Sync Protection
This fork uses `sync-upstream.yml` to automatically sync with the upstream repository.

**Protected files/directories** (defined in `.gitattributes` with `merge=ours`):
- `src/app/custom/**` - All custom code
- `CLAUDE.local.md` - This file

**How it works**:
- `sync-upstream.yml` が毎日JST 03:00に自動実行
- `git config --local merge.ours.driver true` で merge=ours 戦略を有効化
- コンフリクト発生時、保護対象ファイルはローカル版が維持される
- `src/app/custom/.gitkeep` により履歴が分岐し、fast-forward mergeを防止

**Limitations**:
- `merge=ours` はfast-forward merge時には発動しない（.gitkeepで対策済み）
- upstreamが保護パスに**新規ファイル**を追加した場合、ローカルに同名ファイルがなければ取り込まれる（これは意図通り）
- 削除操作の競合は別の挙動になる可能性がある

**Best practices**:
- Never place custom code outside `src/app/custom/`
- If you must modify an upstream file, document it in Knowledge Index below
- Consider creating wrapper components/services instead of direct modifications

## Knowledge Index (Refer to these files when working on related tasks)

### Implemented / Done
- `docs/done/README.md` - 実装完了メモ（Reverse Proxy / Quadlet / Sync workflow / Fork release 等）
- `docs/deployment-guide.md` - デプロイ方法選択ガイド（Docker Compose / Podman Quadlet / Unraid 比較）
- `deploy/podman-quadlet/README.md` - Quadletファイル構成説明 + アーキテクチャ図

### Handoffs / Plans
- `docs/runtime-i18n-handoff-ja.md` - runtime i18n（`ja` + `en` fallback、`custom`中心、ルート差し込み方針）

### i18n 実装完了・次ステップ（2026-01-17 更新）

**実装済み:**
- `src/app/custom/i18n/` - I18nService（Signal-based）、cwT Pipe、en/ja辞書
- `src/app/custom/features/language/` - 言語設定画面（`/settings/language`）
- `src/app/custom/routing/` - APP_INITIALIZERによるルート差し込み
- `src/app/custom/components/proxy-settings/` - i18n対応済み、言語設定への導線追加
- `src/app/custom/services/custom-global-error-handler.service.ts` - i18n対応済みエラーハンドラー（DI差し替え）
- `src/app/custom/services/custom-dialog.service.ts` - i18n対応済みダイアログ（デフォルトボタンテキスト翻訳）
- `src/app/custom/services/custom-memory-warning.service.ts` - i18n対応済みメモリ警告（完全再実装）
- `.gitattributes`に`src/app/app.config.ts merge=ours`追加（保護完了）

**動作確認方法:**
1. `npm start` でアプリ起動
2. `/settings` → Proxyタブ → 「Language Settings」カードをクリック
3. `/settings/language` で `ja`/`en` 切替を確認
4. リロード後も言語が保持されることを確認
5. チャンクロードエラー時のダイアログが選択言語で表示される
6. 確認ダイアログ（Cancel/Confirm/Delete等）が選択言語で表示される
7. メモリ警告トースト（モバイル環境）が選択言語で表示される

**次ステップ（優先度順）:**
1. ~~**`app.config.ts`の保護検討**~~ ✅ 完了
2. ~~**翻訳範囲拡張**~~ ✅ 完了
   - ~~`GlobalErrorHandlerService`~~ ✅ 完了
   - ~~`DialogService`~~ ✅ 完了
   - ~~`MemoryWarningService`~~ ✅ 完了
   - custom以外の画面は翻訳混在OK（fork方針として許容）
3. **Impure Pipe最適化（低優先度）**:
   - 現状`pure: false`で毎CD実行。パフォーマンス問題が出たらSignal-based directiveへ移行検討

**注意点:**
- SSRガード済み（`localStorage`/`document`アクセスはtry-catch）
- upstreamの`app.routes.ts`は未変更（`Router.resetConfig()`で動的注入）
- 翻訳キー追加時は`en.ts`を先に編集→`ja.ts`で型エラーが出るので漏れなし
- `MemoryWarningService`は`private`メソッドのためラップ不可、完全再実装で対応

---

### 日本語テンプレート実装（2026-01-26 完了）

**実装済み（コミット済み）:**
- `src/assets/templates/system-message-ja.txt` - AIシステムプロンプト
- `src/assets/templates/default-beat-rules-ja.txt` - 執筆ルール
- `src/assets/templates/beat-generation-ja.template` - Beat生成プロンプト構造
- `StoryLanguage`型に`'ja'`追加（2箇所）
- 言語選択ダイアログに日本語オプション追加
- `story-list.component.ts`のActionSheetに日本語オプション追加
- `scene-ai-generation.service.ts`に`case 'ja'`追加
- プロキシ接続テストの修正（HEAD→GET /models）
- Claudeプロキシ: URLにバージョン込み（`/v1`）で統一

---

### プロキシ経由モデル一覧取得（2026-01-26 完了）

**実装済み（コミット済み）:**
- `model.service.ts:374` - Claudeモデルのlabelにフォールバック追加 (`model.display_name || model.id`)
- `model.service.ts:34` - `geminiModelsSubject`を`protected`に変更（サブクラスアクセス許可）
- `gemini-api-proxy.service.ts` - `listModels()`と`isProxyEnabled()`メソッド追加
- `custom-model.service.ts` (新規) - `ModelService`を拡張し`loadGeminiModels()`をオーバーライド
- `custom.module.ts` - `{ provide: ModelService, useClass: CustomModelService }` DI設定追加

**動作:**
- Geminiプロキシが有効な場合、`/models`エンドポイントから動的にモデル一覧を取得
- プロキシ無効またはエラー時は従来のハードコードモデル（4モデル）にフォールバック
- `geminiModelsSubject`が更新されるため、`getCurrentGeminiModels()`も正しく動作

**プロキシURL設定ルール（統一済み）:**
| プロバイダー | URL例 | テスト | API呼び出し |
|-------------|-------|--------|-------------|
| Gemini | `https://proxy/v1beta` | `{url}/models` | `{url}/models/{model}:generateContent` |
| Claude | `https://proxy/v1` | `{url}/models` | `{url}/messages` |
| OpenRouter | `https://proxy/api/v1` | `{url}/models` | `{url}/chat/completions` |

---

## Tips & Reminders

### ワークフロー例外
- **ドキュメントのみの変更**（`.md`ファイル等）では `npm run build` / `npm test` / `npm run lint` は**不要**
  - これらはTypeScript/Angularコードに影響する変更時のみ実行すること

### ローカルテスト環境
- **Karma テスト**: Windows環境ではEdgeを使用
  ```cmd
  set CHROME_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe&& npm test -- --no-watch
  ```

### Podman テスト手順（Windows）
`podman.exe` 経由でPod構成をローカルテスト可能：
```cmd
# Pod作成（ポート13080で公開）
podman pod create --name test-cw -p 13080:80

# コンテナ起動
podman run -d --pod test-cw --name test-couchdb -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password ghcr.io/marcodroll/creativewriter-public-couchdb:latest
podman run -d --pod test-cw --name test-replicate -e PORT=3001 ghcr.io/marcodroll/creativewriter-public-proxy:latest
podman run -d --pod test-cw --name test-gemini -e PORT=3002 ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest
podman run -d --pod test-cw --name test-nginx -v "$(pwd)/deploy/podman-quadlet/nginx.conf:/etc/nginx/nginx.conf:ro" ghcr.io/marcodroll/creativewriter-public:latest

# 疎通確認
curl http://127.0.0.1:13080/health
curl http://127.0.0.1:13080/_db/_up
curl http://127.0.0.1:13080/api/replicate/test
curl http://127.0.0.1:13080/api/gemini/test

# クリーンアップ
podman pod rm -f test-cw
```

### nginx.conf差し替えの仕組み
- `creativewriter`イメージは元々nginxベース（静的配信用）
- Quadletでは`Volume=`で統合nginx.confをマウントし、reverse proxy機能を追加
- イメージ再ビルド不要で動作変更可能
