# CreativeWriter2 – Improvement Audit (2025-09-03)

This report captures baseline health (lint/build), notable warnings, and prioritized improvements aligned with Angular 20/Ionic 8 best practices in 2025.

## Baseline
- Build: passed (`npm run build`) with optimization warnings.
- Lint: passed (`npm run lint`).
- Node: v22.19.0; Angular: v20; Ionic: v8.6.

## Quick Wins (1–2 days)
- Error handler wiring: `GlobalErrorHandlerService` exists but is not provided in the standalone app.
  - Action: Register it in `src/app/app.config.ts` via `provide(ErrorHandler, { useClass: GlobalErrorHandlerService })` and delete or deprecate unused `CoreModule`.
  - Files: `src/app/app.config.ts`, `src/app/core/core.module.ts`.

- Logging hygiene: Many `console.log` instances leak in production.
  - Action: Gate logs behind an environment flag or a logger service with level control; strip logs in production builds.
  - Files e.g.: `src/app/shared/services/prosemirror-editor.service.ts:1002`, `src/app/stories/services/story.service.ts:59`, `src/app/shared/services/database-backup.service.ts:*`, `src/app/core/services/google-gemini-api.service.ts:*`.

- CouchDB auth hardcoded in client: Risky for production.
  - Action: Remove hardcoded basic auth; switch to cookie/session auth via reverse proxy; use per-user DB or scoped credentials.
  - File: `src/app/core/services/database.service.ts:~150` (username/password).

- PouchDB version consistency + bundling:
  - CDN loads PouchDB 8.x while `package.json` depends on 9.x.
  - Action: Bundle PouchDB (ESM) via npm to avoid CDN mismatch and improve offline reliability/CSP.
  - File: `src/index.html` (CDN scripts); `package.json`.

- CommonJS optimization bailouts:
  - Build reports CJS usage (e.g., `canvg`, `html2canvas` via `jspdf`).
  - Action: Prefer ESM alternatives or add `allowedCommonJsDependencies` in `angular.json` to document intentional usage; consider swapping to native canvas APIs or ESM forks.

- Stencil/Ionic warning: empty glob in Stencil client and deprecation note for angular-sass plugin.
  - Action: Verify Ionic/Stencils versions and Sass usage; migrate any legacy Sass `@import` to `@use` if present; keep Ionic at 8.6+.

- Build budgets and code-splitting:
  - Initial raw size ~2.11 MB; warning threshold is 2 MB.
  - Action: Reduce vendor chunk (lazy-load heavy features: editor, PDF/JSZip/ProseMirror/jpeg libs) and tighten budgets to catch regressions.

## Medium (3–7 days)
- PWA installability + offline:
  - Action: `ng add @angular/pwa` to generate manifest, icons, and service worker; configure caching for templates/backgrounds.
  - Files: add `manifest.webmanifest`, `ngsw-config.json`, assets under `public/`.

- SSR/Hydration (optional with Ionic caveats):
  - Action: Evaluate `@angular/ssr` for SEO and faster TTI on desktop; hydrate with `provideClientHydration` and ensure Ionic components behave SSR-safe.

- Zoneless + Signals adoption:
  - Action: Gradually move to zoneless change detection and Angular Signals for UI state; keep RxJS for I/O. Start with a leaf feature (e.g., settings panel).

- Route preloading strategy:
  - Action: Enable `withPreloading(PreloadAllModules)` for routes used post-login to improve perceived performance.

- Observability:
  - Action: Optional Sentry/RRWeb integration via an adapter in `core/` with sampling; hook into the global error handler.

## Longer-Term (1–3 sprints)
- Sync architecture hardening:
  - Action: Proxy CouchDB behind an API that mints per-user session cookies; remove credentials from frontend; enable CORS/CSP; consider database-per-user with filtered replication.

- Test coverage uplift:
  - Action: Add unit tests for services with logic (prompt manager, token counter, DB maintenance) and component logic. Add Playwright e2e for critical flows (story CRUD, editor, backups).

- Performance targets:
  - Action: Set explicit `budgets` per lazy feature; audit images/backgrounds sizes; use `ng build --configuration production --named-chunks` to track regressions.

## Concrete Findings & References
- Unused CoreModule provider for error handler
  - `src/app/core/core.module.ts`
  - Not imported in standalone app. Provide error handler via `app.config.ts`.

- Hardcoded CouchDB credentials
  - `src/app/core/services/database.service.ts:~171`
  - Replace with proxy-issued session and remove from client.

- CDN PouchDB mismatch
  - `src/index.html` (8.0.1 CDN) vs npm deps (9.x)
  - Bundle via npm, import ESM, and tree-shake.

- Build warnings: CommonJS and Stencil glob
  - Investigate `canvg`, `jspdf`, `html2canvas` usage; prefer ESM builds or defer loading when exporting.

- Missing PWA assets
  - `public/` contains only `favicon.ico`; add manifest, icons, and service worker.

## Suggested Next Actions
1) Wire up `GlobalErrorHandlerService` in `app.config.ts`; remove `CoreModule` usage and keep providers tree-shakable.
2) Replace PouchDB CDN with npm ESM import and align to 9.x; test replication paths.
3) Add PWA (manifest + SW) and cache policies for assets/templates.
4) Introduce a simple `LoggerService` with log levels; strip verbose logs in prod.
5) Decide on ESM alternatives or an `allowedCommonJsDependencies` allowlist; lazy-load export-heavy features.
6) Plan security refactor for CouchDB auth via proxy sessions (no secrets in frontend).

If you want, I can implement items 1–2 in a short PR and set up item 3 with `ng add @angular/pwa`.

