# CA Template Request - GitHub Issue Draft

**Submit to:** https://github.com/selfhosters/unRAID-CA-templates/issues/new

---

**Title:** [Template Request] CreativeWriter - AI Creative Writing Application

---

**Issue Body:**

## Application Details

**Application Name:** CreativeWriter

**Description:**
AI-enhanced creative writing application for fiction authors. Features multiple AI provider support (OpenRouter, Google Gemini, Ollama for local LLMs), rich text editor with inline images, story structure management, dynamic character/world codex, and automatic backups.

> **Note:** This is an early access version in active development. Stable but expect ongoing improvements.

**GitHub Repository:** https://github.com/MarcoDroll/creativewriter-public

**Docker Registry:** GitHub Container Registry (ghcr.io)

## Docker Images

| Image | Registry Path |
|-------|--------------|
| Main App | `ghcr.io/marcodroll/creativewriter-public:latest` |
| Nginx | `ghcr.io/marcodroll/creativewriter-public-nginx:latest` |
| CouchDB | `ghcr.io/marcodroll/creativewriter-public-couchdb:latest` |
| Replicate Proxy | `ghcr.io/marcodroll/creativewriter-public-proxy:latest` |
| Gemini Proxy | `ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest` |
| Snapshot Service | `ghcr.io/marcodroll/creativewriter-public-snapshot-service:latest` |

## Multi-Container Note

This is a **multi-container application** (6 containers that work together).

**Recommended installation:** Docker Compose Manager plugin

I've prepared Unraid-specific documentation including:
- Optimized docker-compose.yml for Unraid
- XML template
- Step-by-step README

**Documentation:** https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid

## Template Files (Ready to Use)

- **XML Template:** https://github.com/MarcoDroll/creativewriter-public/blob/main/docs/unraid/creativewriter.xml
- **Icon (PNG):** https://github.com/MarcoDroll/creativewriter-public/blob/main/docs/unraid/creativewriter.png
- **Docker Compose:** https://github.com/MarcoDroll/creativewriter-public/blob/main/docs/unraid/docker-compose.yml

## Screenshots

![Main Interface](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/screenshots/Screenshot%202025-08-10%20173755.png)

![Story Structure](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/screenshots/Screenshot%202025-08-11%20083614.png)

## Category

Productivity / Tools

## Additional Notes

- MIT License
- Active development
- Multi-architecture support (amd64, arm64)
- Watchtower compatible for auto-updates
- I'm happy to submit a PR directly if preferred!

---

Thank you for considering this request!
