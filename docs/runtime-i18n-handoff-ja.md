# Runtime i18n（ja + en fallback）導入 Handover（Fork/Sync追随優先）

## 目的 / スコープ
- **目的**: Docker配布を前提に、アプリ内で言語を即時切替できる runtime i18n を追加する（まずは **`ja`**、未対応キーは **`en`** へフォールバック）。
- **重要方針**: upstream同期を壊さないため、変更は可能な限り **`src/app/custom/`** に閉じる（`CLAUDE.local.md` のフォークルール準拠）。
- **今回のスコープ**: “仕組み” と “入口UI” を作る。全画面翻訳はしない（混在OK）。

## 背景（現状把握）
- Angular 20 + Ionic 8 構成。
- `extract-i18n` はあるが、テンプレに `i18n` 属性はほぼ無い（＝Angular標準i18nは全面改修になりやすい）。
- 文字列はテンプレ/TSに多数ハードコードされているため、全面翻訳は upstream差分が膨らみ、sync追随コストが高い。

## 取るアプローチ（B: runtime i18n + 差し替え）
### 結論
- runtime i18n の基盤を **`src/app/custom/`** に実装し、
- ルーティングは **`CustomModule` の `APP_INITIALIZER` で `Router.resetConfig()`** し、`/settings/language` を追加する（upstreamの`app.routes.ts`は触らない）。
- 入口UIは既に `Settings` の “Proxy” タブに組み込まれている `ProxySettingsComponent`（custom）からリンクを出す。

### なぜPR向きではないか（参考）
- upstream本体に入れるなら「全UIの翻訳方針/キー管理/翻訳漏れの扱い」まで含めた設計合意が必要。
- 本方式は “フォークでsync追随を優先する” ための設計（＝上流取り込みやすさ最優先）で、一般にupstream PRとしては判断が重い。

## 実装の全体像（ファイル案）
### 追加（custom内）
- `src/app/custom/i18n/i18n.service.ts`
  - 言語状態（`'ja' | 'en'`）、永続化（`localStorage`）、`t(key, params?)`、`document.documentElement.lang` 更新
- `src/app/custom/i18n/i18n.pipe.ts`
  - `{{ 'key' | cwT }}` 形式の翻訳
- `src/app/custom/i18n/locales/en.ts`
- `src/app/custom/i18n/locales/ja.ts`
  - 辞書（最初は最小でOK）
- `src/app/custom/features/language/language.component.ts|html|scss`
  - 言語切替UI（`ja`/`en`）
- `src/app/custom/routing/custom-routes.initializer.ts`
  - `Router.resetConfig()` を安全に行うヘルパ

### 変更（custom内）
- `src/app/custom/custom.module.ts`
  - `APP_INITIALIZER` を追加して `/settings/language` ルートを差し込む
- `src/app/custom/components/proxy-settings/proxy-settings.component.html`（または `.ts`）
  - `/settings/language` への導線（ボタン/カード）

### 変更（非custom）
- 原則なし（今回の方針では `src/app/app.routes.ts` / `src/app/settings/settings.component.*` は触らない）

## ルーティング差し込み（重要ポイント）
### 目標
- 既存 `routes`（`src/app/app.routes.ts`）は最後に `path: '**'` があるため、単純に末尾追加だと到達不能になり得る。
- そこで `Router.resetConfig()` で **`'**'` より前** に `settings/language` を挿入する。

### 推奨アルゴリズム（擬似コード）
1. `const config = router.config`
2. `const wildcard = config.find(r => r.path === '**')` を退避し、`config`から除去
3. `const settingsIndex = config.findIndex(r => r.path === 'settings')`
4. `config.splice(Math.max(0, settingsIndex), 0, languageRoute)`（`settings`の前に挿入が安全）
5. `config.push(wildcard)` で末尾に戻す
6. `router.resetConfig(config)`

### ルート定義案
- `path: 'settings/language'`
- `loadComponent: () => import('../features/language/language.component').then(m => m.LanguageComponent)`

## i18n基盤（最小仕様）
### 言語の決定ロジック
- `localStorage`（例: `cw.lang`）があれば優先
- それ以外は `navigator.language` / `navigator.languages` から `ja` を判定
- デフォルトは `en`

### フォールバック
- `ja`辞書にキーが無ければ `en` を返す
- それでも無ければ **キー文字列を返す**（クラッシュしないこと優先）

### パラメータ置換（必要になったら）
- まずは `{name}` の単純置換で十分（例: `Hello, {name}`）
- ICU MessageFormat まで要らない（必要が出たら追加）

### `<html lang>` 更新
- `document.documentElement.lang = lang` を `setLang()` で更新
- `src/index.html` の `lang="en"` 固定をランタイムで吸収できる

## 入口UI（Proxyタブから Language へ）
### 方針
- `Settings`本体は触らない（upstream差分0）
- `ProxySettingsComponent` に「Language Settings」導線を追加
  - `RouterLink` を使うか、`Router.navigateByUrl('/settings/language')`

## 翻訳対象の優先順位（段階導入の現実解）
### 最初に効果が出る/差分が少ない領域
- custom側の `Language` 画面自身
- custom側コンポーネント（例: `ProxySettingsComponent` の見出しやボタン）
- DI差し替えで翻訳できる共通UI（オプション）
  - `DialogService`（Confirm/OK/Cancel等）
  - `GlobalErrorHandlerService`（例: chunk更新アラート文言）
  - `MemoryWarningService`（トースト文言）

### 注意
- upstreamテンプレ内文字列の全面置換は、sync追随コストを上げるため後回し。
- 画面の翻訳混在は許容（本方式の前提）。

## AmpCode / Claude Code 向け 実装タスクリスト
### タスク分割（安全な順）
1. `src/app/custom/i18n/` に `I18nService` + `Pipe` + `locales/en|ja` を追加
2. `src/app/custom/features/language/` に言語選択画面を追加（最小UI）
3. `src/app/custom/routing/custom-routes.initializer.ts` を追加（`resetConfig`の安全処理）
4. `src/app/custom/custom.module.ts` に `APP_INITIALIZER` を追加して `/settings/language` を挿入
5. `src/app/custom/components/proxy-settings/proxy-settings.component.html` に導線を追加

### 翻訳キー命名（推奨）
- `common.ok`, `common.cancel`
- `settings.language.title`, `settings.language.description`, `settings.language.ja`, `settings.language.en`
- `errors.chunkUpdate.title`, `errors.chunkUpdate.message`, `errors.chunkUpdate.reload`

## テスト / 検証（実装者向け）
- `npm run build`
- `npm test -- --no-watch`
- `npm run lint`
- 動作確認
  - `/settings` → Proxyタブから `/settings/language` へ遷移できる
  - `ja/en` 切替で即時反映（少なくともLanguage画面とcustom導線部分）
  - リロード後も言語が保持される

## リスク / ハマりどころ
- ルート追加位置を誤ると `path: '**'` に飲まれて到達不能になる（必ず`'**'`より前へ挿入）。
- `resetConfig`を複数回呼ぶ場合、重複ルートを防ぐ（同一`path`を先に除去するなど）。
- 既存UIの大半は未翻訳のままなので、翻訳済み/未翻訳の混在は仕様として説明しておく。

## 将来拡張（まとめたくなったら）
- `/settings` 自体をcustomの“Settingsシェル”に差し替えて、既存の設定コンポーネント（`ApiSettingsComponent`等）を再利用しつつ `Language` タブを追加。
- その時点で差分は増えるが、`settings`周りに局所化できる。

