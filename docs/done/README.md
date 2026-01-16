# Done / 実装完了メモ（参照用）

このディレクトリは、実装完了した機能の“引継ぎ/参照情報”を `CLAUDE.local.md` から分離して置く場所。

## Reverse Proxy Settings（実装完了）
- **Status**: ✅ 実装完了、レビュー指摘対応済み（2026-01-14）
- **Handover**: `docs/reverse-proxy-implementation-handover.md`
- **Spec**: `docs/reverse-proxy-settings.md`
- **Implementation Location**: `src/app/custom/` 配下
- **Key Files**:
  - `src/app/custom/models/proxy-settings.interface.ts`
  - `src/app/custom/services/proxy-settings.service.ts`
  - `src/app/custom/services/claude-api-proxy.service.ts`
  - `src/app/custom/services/openrouter-api-proxy.service.ts`
  - `src/app/custom/services/gemini-api-proxy.service.ts`
  - `src/app/custom/services/ollama-api-proxy.service.ts`
  - `src/app/custom/services/openai-api-proxy.service.ts`
  - `src/app/custom/components/proxy-settings/`
  - `src/app/custom/custom.module.ts`
- **Build Status**: ✅ build / lint / test 全パス
- **Reference (upstream, DO NOT MODIFY)**:
  - `src/app/core/services/claude-api.service.ts`
  - `src/app/core/services/openrouter-api.service.ts`
  - `src/app/core/services/google-gemini-api.service.ts`
  - `src/app/core/services/ollama-api.service.ts`
  - `src/app/core/services/openai-compatible-api.service.ts`

## Podman/Quadlet Deployment（実装完了）
- **Status**: ✅ 実装完了（2026-01-15）
- **Handover**: `docs/podman-quadlet-handover.md`
- **Documentation**: `docs/podman-quadlet.md`
- **Implementation Location**: `deploy/podman-quadlet/`
- **Key Files**:
  - `deploy/podman-quadlet/nginx.conf`
  - `deploy/podman-quadlet/creativewriter@.pod`
  - `deploy/podman-quadlet/creativewriter.container`
  - `deploy/podman-quadlet/couchdb.container`
  - `deploy/podman-quadlet/replicate-proxy.container`
  - `deploy/podman-quadlet/gemini-proxy.container`
  - `deploy/podman-quadlet/snapshot-service.container`
  - `deploy/podman-quadlet/creativewriter-stack@.target`
  - `deploy/podman-quadlet/creativewriter.env.example`
- **Build Status**: ✅ build / lint / test 全パス
- **Design Decisions**:
  - reverse proxyコンテナを廃止し、単一nginxに統合（Pod内ポート競合回避）
  - `^~` prefix locationでAPI優先度を確保（SPA try_filesとの競合防止）
  - Gemini SSE対応（proxy_buffering off, 3600s timeout）
  - 環境変数は `~/.config/creativewriter/creativewriter.env` で一元管理

## Upstream Sync Workflow（実装完了）
- **Status**: ✅ 完了
- **Files**:
  - `.github/workflows/sync-upstream.yml`
  - `.gitattributes`
  - `src/app/custom/.gitkeep`
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

## Fork Docker Release Workflow（実装完了）
- **Status**: ✅ 実装完了（2026-01-15）
- **Purpose**: フォーク用のDockerイメージをghcr.io/hirsaeki/にプッシュ
- **Key Files**:
  - `.github/workflows/docker-build.yml`
  - `.github/workflows/create-release.yml`
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

