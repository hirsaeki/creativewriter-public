# Release v1.4.202509021127

**Date:** 2025-09-02  
**Commits:** 46 commits since v1.3.0

## ✨ Major Features

### 🌐 Language & UX Improvements
- Replaced language selection Modal with an Ionic Action Sheet for better mobile UX
- Clearer explanation and flow for "Local‑Only Mode" in the login dialog
- Modernized language selection with refined, glass‑morphism styling and compact layout

### 📝 Multilingual AI Authoring
- Added multilingual support for AI story generation via externalized template files
- Enhanced system messages with detailed fiction‑writing guidance for higher‑quality outputs
- German category support with automatic migration to English

### 📚 Codex Enhancements
- Auto‑create character fields in the codex based on selected category
- Safer metadata model for custom fields to avoid divergence

## 🐛 Bug Fixes

- Local‑only mode now persists across page reloads
- Language selector: fixed height, spacing, and visibility issues across breakpoints
- Codex tags: prevented mutation and duplication; standardized handling during real‑time updates
- Story settings: removed automatic template updates to avoid accidental data loss

## ♻️ Code & Performance

- Migrated CommonJS → ESM where possible to improve optimization
- Adopted OnPush change detection for major components
- Reduced CSS size across several components
- Mobile performance optimizations: image compression and lazy loading

## 🏗️ Infrastructure

- CouchDB added and hardened in public workflows (improved defaults, streamlined init)
- Full set of public Docker images published: app, nginx, replicate proxy, gemini proxy

## 📊 Statistics

- **Total Commits:** 46
- **Contributors:** 1
- **Files Changed:** 300
- **Additions:** +914
- **Deletions:** -18536

## 🔗 Links

- Compare: https://github.com/MarcoDroll/creativewriter-public/compare/v1.3.0...v1.4.202509021127
- Docker Images: https://github.com/MarcoDroll/creativewriter-public/pkgs/container/creativewriter-public

## 📦 Installation

### Docker Compose

