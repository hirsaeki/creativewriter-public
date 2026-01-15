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

### i18n 実装完了・次ステップ（2026-01-15）

**実装済み:**
- `src/app/custom/i18n/` - I18nService（Signal-based）、cwT Pipe、en/ja辞書
- `src/app/custom/features/language/` - 言語設定画面（`/settings/language`）
- `src/app/custom/routing/` - APP_INITIALIZERによるルート差し込み
- `src/app/custom/components/proxy-settings/` - i18n対応済み、言語設定への導線追加

**動作確認方法:**
1. `npm start` でアプリ起動
2. `/settings` → Proxyタブ → 「Language Settings」カードをクリック
3. `/settings/language` で `ja`/`en` 切替を確認
4. リロード後も言語が保持されることを確認

**次ステップ（優先度順）:**
1. **`app.config.ts`の保護検討**: `.gitattributes`に`src/app/app.config.ts merge=ours`追加
   - 現状`CustomModule`のimportがupstream syncでコンフリクトする可能性あり
2. **翻訳範囲拡張（オプション）**:
   - DI差し替えサービスへの翻訳追加（`DialogService`, `GlobalErrorHandlerService`, `MemoryWarningService`）
   - custom以外の画面は翻訳混在OK（fork方針として許容）
3. **Impure Pipe最適化（低優先度）**:
   - 現状`pure: false`で毎CD実行。パフォーマンス問題が出たらSignal-based directiveへ移行検討

**注意点:**
- SSRガード済み（`localStorage`/`document`アクセスはtry-catch）
- upstreamの`app.routes.ts`は未変更（`Router.resetConfig()`で動的注入）
- 翻訳キー追加時は`en.ts`を先に編集→`ja.ts`で型エラーが出るので漏れなし

---

## Tips & Reminders

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
