# Unraid Forum Support Thread Draft

**Post to:** https://forums.unraid.net/forum/47-docker-containers/

**Title:** [Support] CreativeWriter - AI-Enhanced Creative Writing Application

---

**Post Content:**

## CreativeWriter

> **⚠️ Early Access:** This is an early version in active development. Expect bugs, missing features, and frequent changes. Use at your own risk and consider it experimental software.

CreativeWriter is a powerful, self-hosted creative writing application that helps fiction authors craft compelling stories with AI assistance.

### Screenshots

![Main Interface](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/screenshots/Screenshot%202025-08-10%20173755.png)
*Main writing interface with AI-powered beat assistance*

![Story Structure](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/screenshots/Screenshot%202025-08-11%20083614.png)
*Organize narratives with chapters and scenes*

![Codex System](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/screenshots/Screenshot%202025-08-11%20083221.png)
*Dynamic character and world-building database*

### Features

- **Multiple AI Providers**: OpenRouter, Google Gemini, and Ollama (local LLMs)
- **Rich Text Editor**: Full-featured editor with inline image support
- **Story Structure**: Organize with acts, chapters, scenes, and beats
- **Dynamic Codex**: Track characters, locations, and plot elements
- **Beat Version History**: Save and restore previous AI generations
- **PDF Export**: Generate formatted PDFs of your stories
- **Automatic Backups**: Snapshot service for peace of mind

### Installation (Docker Compose Manager - Recommended)

This is a multi-container application (6 containers). The easiest installation method is via Docker Compose Manager.

**Prerequisites:**
- Unraid 6.12+
- Docker Compose Manager plugin (install from CA)

**Steps:**

1. Install "Docker Compose Manager" from Community Applications
2. Go to **Docker** tab → scroll down → **Add New Stack**
3. Name it `CreativeWriter` and click Save
4. Click the gear icon → **Edit Stack** → **Compose File**
5. Paste the contents from: [docker-compose.yml](https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/unraid/docker-compose.yml)
6. **IMPORTANT:** Edit these values before saving:
   - Change `COUCHDB_PASSWORD` to a secure password
   - Change `COUCHDB_SECRET` to a random string
   - Adjust `TZ` to your timezone (e.g., `America/New_York`)
7. Click **Save Changes** → **Compose Up**
8. Access at `http://YOUR-UNRAID-IP:3080`

### Post-Installation

1. Go to **Settings** → **AI Providers**
2. Add API keys for your preferred providers:
   - **OpenRouter**: https://openrouter.ai/
   - **Google Gemini**: https://makersuite.google.com/app/apikey
   - **Ollama**: Use `http://YOUR-UNRAID-IP:11434` if running locally

### Data Location

Your stories are stored in: `/mnt/user/appdata/creativewriter/couchdb-data/`

**Add this to your backup solution!**

### Updating

1. Docker tab → gear icon on CreativeWriter stack
2. **Compose Down** → **Compose Pull** → **Compose Up**

Or use Watchtower for automatic updates (labels are included).

### Links

- **GitHub**: https://github.com/MarcoDroll/creativewriter-public
- **Documentation**: https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid
- **Issues/Bug Reports**: https://github.com/MarcoDroll/creativewriter-public/issues
- **Docker Images**: https://github.com/MarcoDroll/creativewriter-public/pkgs/container/creativewriter-public

### Container Overview

| Container | Purpose |
|-----------|---------|
| creativewriter-nginx | Reverse proxy / web server |
| creativewriter-app | Main Angular application |
| creativewriter-couchdb | Database for stories |
| creativewriter-replicate-proxy | AI image generation proxy |
| creativewriter-gemini-proxy | Google Gemini API proxy |
| creativewriter-snapshot-service | Automated backups |

### Support

Please report bugs and issues on GitHub. For Unraid-specific questions, feel free to post in this thread!

---

**Support the Project:**
If you find CreativeWriter helpful: [Buy Me A Coffee](https://www.buymeacoffee.com/nostramo83)
