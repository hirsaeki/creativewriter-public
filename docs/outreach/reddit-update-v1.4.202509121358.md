# Reddit Update — CreativeWriter v1.4.202509121358

Below are two copy-ready options you can paste into your Reddit post. The first is a short comment update. The second is a longer OP edit/update.

---

## Short Comment Update

🚀 Release Update: v1.4.202509121358 is live

- ✨ What’s new: Inspector module with Cliché Analyzer (beta), shared Model Selector, UI refactor to `src/app/ui`, editor and sync improvements.
- 📦 Images: multi-arch on GHCR; stable tags update shortly after release.
- 🔗 Release notes: https://github.com/MarcoDroll/creativewriter-public/releases/tag/v1.4.202509121358

Quick start

```bash
# Pull pinned images
docker pull ghcr.io/marcodroll/creativewriter-public:v1.4.202509121358
docker pull ghcr.io/marcodroll/creativewriter-public-nginx:v1.4.202509121358

# Or pull stable tags (roll forward shortly after release)
docker pull ghcr.io/marcodroll/creativewriter-public:stable
docker pull ghcr.io/marcodroll/creativewriter-public-nginx:stable

# Update your stack
docker compose pull && docker compose up -d
```

Notes

- Build verified; known CommonJS warnings from third‑party libs are harmless.
- No config changes or DB migrations required for this release.
- Feedback welcome on Inspector checks and Model Selector UX.

---

## Longer OP Edit/Update

### 🚀 Release v1.4.202509121358
This release focuses on writing quality insights and smoother model selection.

### ✨ What’s New
- Inspector (beta): Cliché Analyzer for quick stylistic nudges (`src/app/inspector/**`).
- Model Selector: Easily switch between AI models/providers (`src/app/shared/components/model-selector/*`).
- UI refactor: Components consolidated under `src/app/ui`; standalone Angular setup (no `core.module.ts`).
- Editor & sync: ProseMirror editor refinements and PouchDB sync stability.

### 📦 Docker Images
- Pinned to this release
  - `ghcr.io/marcodroll/creativewriter-public:v1.4.202509121358`
  - `ghcr.io/marcodroll/creativewriter-public-nginx:v1.4.202509121358`
- Stable tags (roll forward shortly after release)
  - `ghcr.io/marcodroll/creativewriter-public:stable`
  - `ghcr.io/marcodroll/creativewriter-public-nginx:stable`

### 🛠️ How to Update
```bash
docker compose pull && docker compose up -d
```
No schema migrations or config changes needed.

### ⚠️ Notes
- Build and lint pass; known CommonJS optimization warnings from canvg/pouchdb/html2canvas do not affect functionality.
- Multi-arch images (AMD64/ARM64); stable tags may take a few minutes to update.

### 🔗 Links
- Release notes: https://github.com/MarcoDroll/creativewriter-public/releases/tag/v1.4.202509121358
- Public repo: https://github.com/MarcoDroll/creativewriter-public

### 🗺️ Next
- Expand Inspector checks, improve Model Selector ergonomics, and continue editor QoL.

### 💬 Feedback
Tell me which writing assists you value most (style, structure, summaries) and which models/providers to prioritize.

