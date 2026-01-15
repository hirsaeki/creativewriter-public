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

### Reverse Proxy Settings (実装完了)
- **Status**: ✅ 実装完了、レビュー指摘対応済み（2026-01-14）
- **Handover**: `docs/reverse-proxy-implementation-handover.md` - 引継資料
- **Spec**: `docs/reverse-proxy-settings.md` - 設計仕様書
- **Implementation Location**: `src/app/custom/` 配下に実装済み
- **Key Files**:
  - `src/app/custom/models/proxy-settings.interface.ts` - 型定義
  - `src/app/custom/services/proxy-settings.service.ts` - 設定管理
  - `src/app/custom/services/claude-api-proxy.service.ts` - Claude プロキシ
  - `src/app/custom/services/openrouter-api-proxy.service.ts` - OpenRouter プロキシ
  - `src/app/custom/services/gemini-api-proxy.service.ts` - Gemini プロキシ
  - `src/app/custom/services/ollama-api-proxy.service.ts` - Ollama プロキシ
  - `src/app/custom/services/openai-api-proxy.service.ts` - OpenAI互換 プロキシ
  - `src/app/custom/components/proxy-settings/` - 設定UI
  - `src/app/custom/custom.module.ts` - DI設定
- **Build Status**: ✅ build / lint / test 全パス
- **Reference (upstream, DO NOT MODIFY)**:
  - `src/app/core/services/claude-api.service.ts`
  - `src/app/core/services/openrouter-api.service.ts`
  - `src/app/core/services/google-gemini-api.service.ts`
  - `src/app/core/services/ollama-api.service.ts`
  - `src/app/core/services/openai-compatible-api.service.ts`

### Podman/Quadlet Deployment (実装完了)
- **Status**: ✅ 実装完了（2026-01-15）
- **Handover**: `docs/podman-quadlet-handover.md` - 設計方針書
- **Documentation**: `docs/podman-quadlet.md` - 配置・起動手順
- **Implementation Location**: `deploy/podman-quadlet/` 配下
- **Key Files**:
  - `deploy/podman-quadlet/nginx.conf` - 統合nginx設定（静的配信+リバースプロキシ）
  - `deploy/podman-quadlet/creativewriter@.pod` - Podテンプレート（ポート可変）
  - `deploy/podman-quadlet/creativewriter.container` - メインnginxコンテナ
  - `deploy/podman-quadlet/couchdb.container` - CouchDBコンテナ
  - `deploy/podman-quadlet/replicate-proxy.container` - Replicate/fal.aiプロキシ
  - `deploy/podman-quadlet/gemini-proxy.container` - Geminiプロキシ（SSE対応）
  - `deploy/podman-quadlet/snapshot-service.container` - スナップショットサービス
  - `deploy/podman-quadlet/creativewriter-stack@.target` - 一括起動ターゲット
  - `deploy/podman-quadlet/creativewriter.env.example` - 環境変数テンプレート
- **Build Status**: ✅ build / lint / test 全パス
- **Design Decisions**:
  - reverse proxyコンテナを廃止し、単一nginxに統合（Pod内ポート競合回避）
  - `^~` prefix locationでAPI優先度を確保（SPA try_filesとの競合防止）
  - Gemini SSE対応（proxy_buffering off, 3600s timeout）
  - 環境変数は `~/.config/creativewriter/creativewriter.env` で一元管理

### Upstream Sync Workflow (実装完了)
- **Status**: 完了
- **Files**:
  - `.github/workflows/sync-upstream.yml` - 同期ワークフロー本体
  - `.gitattributes` - 保護対象パスの定義
  - `src/app/custom/.gitkeep` - 履歴分岐用プレースホルダー
- **Key Implementation**:
  - `merge.ours.driver true` を設定してmerge=ours戦略を有効化
  - `-X ours` オプションでmodify/deleteコンフリクトも自動解決
  - 毎日JST 03:00に自動実行（手動実行も可能）
- **Protected Paths**:
  - `src/app/custom/**`
  - `CLAUDE.local.md`
  - `AGENTS.md`
  - `.github/workflows/docker-build.yml`
  - `.github/workflows/create-release.yml`

### Fork Docker Release Workflow (実装完了)
- **Status**: ✅ 実装完了（2026-01-15）
- **Purpose**: フォーク用のDockerイメージをghcr.io/hirsaeki/にプッシュ
- **Key Files**:
  - `.github/workflows/docker-build.yml` - Dockerビルド・プッシュ（フォーク用に調整済み）
  - `.github/workflows/create-release.yml` - タグプッシュで自動リリース作成
- **Flow**:
  1. `git tag v2.0.0-fork.YYYYMMDDHHMM && git push --tags`
  2. `create-release.yml` がGitHub Releaseを自動作成（`-fork`等含むタグはprerelease）
  3. Release公開で `docker-build.yml` がトリガー
  4. マルチプラットフォーム（amd64/arm64）イメージをghcr.ioにプッシュ
- **Changes from Upstream**:
  - `BASE_IMAGE_NAME`: ハードコード → `${{ github.repository }}` で動的化
  - OCI ラベル: source/url/vendor/title を GitHub コンテキスト変数で動的化
  - Cloudflareキャッシュパージジョブ: 削除（フォーク不要）
- **Image Registry**: `ghcr.io/hirsaeki/creativewriter-public[-suffix]:tag`
- **Protected**: `.gitattributes` で `merge=ours` 設定済み（upstream syncで上書きされない）

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

