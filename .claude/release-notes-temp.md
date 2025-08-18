# Release v[1;33mCurrent version: 1.1.0[0m
Suggested versions:
  1) Patch: 1.1.1 (bug fixes)
  2) Minor: 1.2.0 (new features)
  3) Major: 2.0.0 (breaking changes)
  4) Custom version
1.2.0

**Date:** 2025-08-18  
**Commits since last release:** 132

## Highlights

- feat: add comprehensive release preparation automation
- fix: update Beat AI button disabled conditions for sync vs save
- fix: improve token analysis model detection using metadata
- feat: add colored icons to Beat AI buttons
- feat: replace Cancel button text with red cross icon

## 🚀 New Features

- add comprehensive release preparation automation (`6eb34f5`)
- add colored icons to Beat AI buttons (`a83abd7`)
- replace Cancel button text with red cross icon (`c535ac8`)
- change Generate button icon to magic wand (`41ea27a`)
- replace Generate button text with pen icon (`1f4a245`)
- disable Beat AI Generate and Preview buttons during sync (`ece7e68`)
- add PDF export progress indicator for large stories (`1b150be`)
- add database backup and restore functionality (`bbbf3bd`)
- add distinctive colored glows for generate, preview, and cancel buttons (`a3cc26a`)
- restore button sizes and enhance glow effects on hover (`788b777`)
- unify generate/preview/cancel buttons with action button styling (`37492cc`)
- make buttons smaller and more transparent (`e29b784`)
- neutralize button styling and increase transparency (`b905bab`)
- flatten button styling to remove 3D effects (`bea2f5e`)
- enhance buttons with premium glass-like styling (`de468e2`)
- modernize beat input buttons with 2025 design trends (`9287a3c`)
- enhance image size display with real-time updates and estimates (`0c73f96`)
- integrate image memory size display and compression ratio (`9e6c922`)
- add image cropping and compression to story editor (`c9814e8`)
- comprehensive feature release with Ollama local AI integration (`bb9221e`)
- implement real-time streaming for Ollama AI generation (`d0c117f`)
- add Ollama local AI integration (`89ded67`)
- add Claude agent configuration for release management (`ac3892d`)
- persist additional scene selection and story outline settings in beat input (`67ab7cf`)
- add workflows to build and publish all public Docker images (`61a91ba`)
- add automatic release creation after public repository sync (`44bbab3`)

## 🐛 Bug Fixes

- update Beat AI button disabled conditions for sync vs save (`0d73762`)
- improve token analysis model detection using metadata (`913af78`)
- make Beat AI delete button always visible and active (`dab1dbb`)
- improve sync error handling to prevent JSON parsing errors (`565ef59`)
- improve PDF export validation and error handling (`e7dfe58`)
- enhance PDF export functionality with better error handling and fallback (`90b9867`)
- ensure import busy indicator stops properly (`a9871ea`)
- resolve attachment stub errors in database backup/restore (`9bc98e6`)
- resolve TypeScript and ESLint issues in database backup service (`0aa1ddb`)
- improve database backup/restore to completely replace database (`33ea484`)
- remove !important overrides that were forcing blue button styling (`b011298`)
- restore WebP format with balanced compression settings (`a50ba51`)
- reduce aggressive compression in image cropper (`a3a6eaf`)
- improve image size info display and add debug logging (`7315621`)
- handle Promise returned by manual crop method (`d2e6500`)
- show resize handles in free cropping mode (`b125df5`)
- enable free cropping by reinitializing cropper when aspect ratio changes (`6b893bc`)
- set proper background color for image cropper using CSS variables (`028c08f`)
- remove white background from image cropper component (`fa12fd4`)
- resolve aspectRatio validation error in image cropper (`be57d10`)
- correct icon name from 'tag' to 'pricetag' in codex component (`1fe8d94`)
- resolve XSS vulnerabilities by replacing innerHTML with safe DOM methods (`b6d73f5`)
- translate final German UI text in component interfaces (`165d021`)
- comprehensive translation of all remaining German UI text (`491e370`)
- translate remaining German UI strings to English (`7e47919`)
- translate German text to English for consistency (`9791e0c`)
- translate remaining German UI strings to English (`c3ada53`)
- translate German text to English for consistency (`9ba858f`)
- improve public sync workflow to preserve commit messages and prevent double-triggering (`f45eec6`)
- remove remaining header references in Ollama service (`e4ab799`)
- remove CORS-problematic headers from Ollama requests (`bd4813f`)
- ensure includeStoryOutline defaults to true and persists correctly (`36da516`)
- restore selectedScenes and includeStoryOutline from ProseMirror DOM parsing (`fe62abd`)
- use bracket notation for Record<string, unknown> attributes (`b0bf40b`)
- implement complete database persistence for beat scene selections (`a1d57e5`)
- properly restore persisted scene selections when editing beats (`d306ce1`)
- remove attestation and provenance from public Docker workflow (`8c64e16`)
- create public docker-compose.yml with correct image references for creativewriter-public (`ffd645a`)

## 📚 Documentation

- add simple Claude agent configuration for release automation (`7b8f7e1`)
- add environment variables section to Getting Started (`d547c62`)
- add critical persistent storage warning to Getting Started section (`b1d5d5b`)
- emphasize critical importance of persistent volume mounting (`46a07e9`)
- add essential CORS configuration for Ollama integration (`a8cecbf`)
- update README with Ollama integration and local AI support (`6526690`)
- add table of contents with jump links to README files (`0c55b0f`)
- update README files to reflect all Docker images are now published (`6e80402`)
- add Docker images auto-publish status update (`409a7e0`)
- add Docker images auto-publish status update (`ba90e90`)
- update README with accurate Docker image availability status (`58379c6`)
- update README files with Docker build instructions for public images (`3b346ed`)

## ♻️ Refactoring

- organize slash-command-dropdown component into subfolder structure (`5db6df2`)
- organize story-stats component into subfolder structure (`b8f8fb9`)
- organize ai-log-tab component into subfolder structure (`d0c2f8a`)
- organize story-settings component into subfolder (`f28461e`)
- organize scene-chat component into subfolder (`efcaa74`)
- organize story-structure component into subfolder (`7de05a5`)
- organize story-list component into subfolder with external template and styles (`a19d700`)
- organize story-editor component into subfolder with external template and styles (`72364db`)
- organize beat-ai component into dedicated subfolder (`8cccd12`)
- split beat-ai component into separate template, styles, and TypeScript files (`b7bf4b6`)

## 🔧 Other Changes

- Translate sync logs from German to English (`3ed6221`)
- Add comprehensive code review with security analysis (`5423638`)
- remove: export functionality from DB maintenance tab (`eafb118`)
- Remove icon from preview button to avoid Ionic icon warning (`8c96be8`)
- Use solid eye icon instead of outline for better visibility (`84f70f8`)
- Fix Ionic icon visibility in beat input buttons (`0b46ca5`)
- Replace emoji eye icon with proper Ionic icon in preview button (`ce1787b`)
- fix(story-editor): prevent updateHeaderActions from overriding heart icon (`230c0da`)
- refactor(story-editor): change Buy Me a Coffee icon from cafe to heart (`cd24f23`)
- feat(story-editor): replace broken save status with Buy Me a Coffee button (`aa4dcb7`)
- docs(readme): emphasize image support within text feature (`558acc8`)
- revert: remove cropper reinitialize logic that interfered with mouse interaction (`78ef823`)
- revert: remove ineffective CSS background fixes for image cropper (`384d3c3`)
- enhance: optimize image cropper with mobile support and performance improvements (`952ec93`)
- cleanup: remove unused components (`b6566fe`)
- refactor(codex-relevance): split demo, settings, and test components into separate template, styles, and TypeScript files (`06c6459`)
- refactor(novelcrafter-import): split component into separate template, styles, and TypeScript files (`c65e1df`)
- refactor(log-viewer): split component into separate template, styles, and TypeScript files (`8f4b259`)
- refactor(image-generation): split component into separate template, styles, and TypeScript files (`c78ac2d`)
- refactor(sync-log-tab): split component into separate template, styles, and TypeScript files (`1229426`)

## 👥 Contributors

- User
- github-actions[bot]

## Full Changelog

View all changes: [`v1.0.1...v[1;33mCurrent version: 1.1.0[0m
Suggested versions:
  1) Patch: 1.1.1 (bug fixes)
  2) Minor: 1.2.0 (new features)
  3) Major: 2.0.0 (breaking changes)
  4) Custom version
1.2.0`](https://github.com/MarcoDroll/creativewriter2/compare/v1.0.1...v[1;33mCurrent version: 1.1.0[0m
Suggested versions:
  1) Patch: 1.1.1 (bug fixes)
  2) Minor: 1.2.0 (new features)
  3) Major: 2.0.0 (breaking changes)
  4) Custom version
1.2.0)
