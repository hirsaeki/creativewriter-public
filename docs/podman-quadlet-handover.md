# Podman rootless + systemd user (Quadlet) 対応 Handover

## 目的 / スコープ
- **目的**: CreativeWriter を **Podman rootless** 環境で **systemd --user (Quadlet)** 管理できるようにする。
- **クリティカル要件**:
  - **ポート競合回避**（Pod内でのport衝突、ホスト側公開ポートの衝突）
  - **環境変数注入**（.env相当をsystemd user配下で安全に注入）
- **このHandoverの前提**: まずは Podman/Quadlet を優先。Kubernetes は「後でどっちでも」程度。

## 現状（public repo）
- `docker-compose.yml` では以下の構成:
  - `nginx`（reverse proxy, listen :80 → host `${PORT:-3080}`）
  - `creativewriter`（Angular静的配信nginx, listen :80 ただし外部公開なし）
  - `couchdb`（:5984 外部公開なし）
  - `replicate-proxy`（Node, `PORT=3001`）
  - `gemini-proxy`（Node, `PORT=3002`）
  - `snapshot-service`（Node, CouchDB監視）
- reverse proxy 設定は `nginx/nginx.conf`。
- 静的配信側nginx設定は `nginx.conf`（repo root）。

## なぜPodman Podで問題になるか（重要）
Podman の Pod は **ネットワーク名前空間を共有**します。
- いまのcompose相当を「同一Pod」に詰めると、
  - `nginx`（reverse proxy）が **:80**
  - `creativewriter`（static nginx）も **:80**
  → **Pod内で80番が競合**して起動できません。

Kubernetes Pod でも同様に、同一Pod内で同じポートは競合します。

## 推奨アプローチ（Low Upstream Conflict）
### 結論
- **reverse proxy用 `nginx` コンテナを廃止**し、
- `creativewriter-public` イメージ（静的配信nginx）を **単一の入口**にして
  - 静的配信（SPA）
  - `/_db/` → couchdb
  - `/api/*` → 各プロキシ
  を **同一nginx.confに統合**する。

### Upstream衝突回避のポイント
- 既存イメージの再ビルド不要。
- `creativewriter-public` コンテナの `/etc/nginx/nginx.conf` を **ホストからマウントして差し替え**。
- 変更は「新規ファイル（deploy/docs）」中心で済み、アプリコードを触らない。

## 実装タスク（AmpCode向け）

### 1) 統合nginx.confを作る
ベース:
- 静的配信設定: `nginx.conf`（repo root）
- reverse proxy設定: `nginx/nginx.conf`

統合の要点:
- `location /` は **静的配信の `try_files ... /index.html` を維持**（proxyにしない）
- `/_db/` と `/api/*` の `location` を追加
- upstreamの宛先は Pod内なので **コンテナ名DNSではなく localhost** にする
  - `couchdb:5984` → `127.0.0.1:5984`
  - `replicate-proxy:3001` → `127.0.0.1:3001`
  - `gemini-proxy:3002` → `127.0.0.1:3002`
- `nginx/nginx.conf` の `resolver 127.0.0.11` は不要（docker内DNS前提のため）
- 既存のキャッシュ制御（`/index.html`, `/assets/version.json`, hashed assets）を壊さない
- GeminiのSSE（`/api/gemini/*` で streaming があり得る）を考慮し、必要なら該当locationに `proxy_buffering off` / `proxy_request_buffering off` / timeout 等を入れる

最低限の疎通チェック:
- `GET /health` → 200
- `GET /_db/_up`（`/_db/` rewrite後に `/_up`）→ 200
- `GET /api/replicate/test` → 200
- `GET /api/gemini/test` → 200

### 2) Quadlet構成を追加する
新規ディレクトリ案:
- `deploy/podman-quadlet/`

構成方針:
- **Podテンプレ**（インスタンス引数でホスト公開ポートを可変）
  - 例: `creativewriter@3080` で 3080公開、`creativewriter@18080` で 18080公開
- すべてのコンテナを同一Podに参加（localhostで相互到達）
- 公開はPod側で `PublishPort` する（container側では公開しない）

Quadletファイル（例: 命名案）:
- `deploy/podman-quadlet/creativewriter@.pod`
- `deploy/podman-quadlet/creativewriter.container`（= web/entrypoint）
- `deploy/podman-quadlet/couchdb.container`
- `deploy/podman-quadlet/replicate-proxy.container`
- `deploy/podman-quadlet/gemini-proxy.container`
- `deploy/podman-quadlet/snapshot-service.container`
- `deploy/podman-quadlet/creativewriter-stack@.target`（まとめ起動）

重要設定（Quadlet/systemd user）:
- `Pod=creativewriter@%i.pod` のように **同一Pod参加**
- `EnvironmentFile=%h/.config/creativewriter/creativewriter.env` を各containerで参照
- `Volume=` でデータ永続化（couchdb, logs）
- `Restart=always` 相当（Quadletの `Restart=` など）

### 3) ENV注入方式
- `.env` 相当は **ユーザーのホーム配下**に置く:
  - `~/.config/creativewriter/creativewriter.env`
- Quadlet側は `EnvironmentFile=` で読み込む
- repoには雛形として `deploy/podman-quadlet/creativewriter.env.example` を置く

最低限必要なENV:
- CouchDB:
  - `COUCHDB_USER`
  - `COUCHDB_PASSWORD`
  - `COUCHDB_SECRET`
  - `TZ`
- Snapshot service:
  - `COUCHDB_HOST=localhost`（Pod内なので）※実装で上書き
  - `COUCHDB_PORT=5984`
  - `DATABASE_PATTERN`, `SNAPSHOT_ENABLED`, `LOG_LEVEL` etc.

注意:
- `docker-compose.yml` は `snapshot-service` に `COUCHDB_HOST=couchdb` を入れているが、Pod内では `localhost` が素直。

### 4) 永続化（Volumes）
- CouchDBデータとログを永続化
  - 例: `~/.local/share/creativewriter/data/couchdb-data` → `/opt/couchdb/data`
  - 例: `~/.local/share/creativewriter/log/couchdb_log` → `/opt/couchdb/var/log`
- Snapshot serviceログ:
  - `~/.local/share/creativewriter/log/snapshot-service` → `/var/log/snapshot-service`

（SELinux環境を考えるなら `:Z`/`:z` の注記をドキュメントに入れる）

### 5) ドキュメント
- `docs/podman-quadlet.md` を追加
  - Quadletファイルの配置先: `~/.config/containers/systemd/`
  - env/設定の配置先: `~/.config/creativewriter/`
  - 起動/停止/更新:
    - `systemctl --user daemon-reload`
    - `systemctl --user enable --now creativewriter-stack@3080.target`
    - `systemctl --user status creativewriter-stack@3080.target`
  - ポート競合回避: `@3080` を `@18080` に変えるだけ、など
  - 疎通確認コマンド（curl）

## テストチェックリスト（ローカル）
- Pod作成/起動: `systemctl --user start creativewriter-stack@3080.target`
- Web: `curl -f http://127.0.0.1:3080/health`
- CouchDB: `curl -f http://127.0.0.1:3080/_db/_up`
- Proxy:
  - `curl -f http://127.0.0.1:3080/api/replicate/test`
  - `curl -f http://127.0.0.1:3080/api/gemini/test`
- ブラウザでトップ画面が表示され、保存/同期関連が壊れていないこと

## リスク / 留意点
- `nginx.conf` 統合時に、SPAの `try_files` と `/api/*` のlocation優先順位を壊すと、JS/CSSが404やMIME errorになる。
- `/_db/` のrewriteやCORS/Authorization透過は壊れやすいので、curlで先に確認。
- 既存の `nginx/nginx.conf` は docker DNS前提（`resolver 127.0.0.11`）なので、そのまま持ってこない。

## 将来: Kubernetesへの流用
- 同一Pod内で二段nginxは同じ理由で不利。
- 「単一nginx + sidecars（couchdb/proxy）」方針はそのままK8sに流用可能。
- 必要になったら `k8s/` に Deployment/Service を追加する。

---

実装開始時の最初のアクション案:
1. `deploy/podman-quadlet/` を新設（Quadletユニット雛形追加）
2. `deploy/podman-quadlet/nginx.conf` を作成（`nginx.conf` と `nginx/nginx.conf` を統合）
3. `docs/podman-quadlet.md` を追加（配置/起動/ENV/疎通）
