# Reddit Post Draft for /r/selfhosted

## Target
- Subreddit: /r/selfhosted
- Type: First announcement / introduction post
- Purpose: Introduce CreativeWriter to the self-hosting community

---

## Suggested Title

**CreativeWriter - Self-hosted AI writing app with Ollama support (Docker + Unraid template)**

---

## Post Body (copy from here)

**TL;DR:** Open-source AI writing app for fiction authors. One docker-compose, works with local Ollama models (no cloud required), Unraid-ready.

---

Hey selfhosters!

I wanted to share **CreativeWriter**, an AI-enhanced writing application I've been building. It's designed to run entirely on your own hardware with full data ownership.

## Why Self-Host a Writing App?

Writing tools with AI features typically require cloud subscriptions and store your work on someone else's servers. CreativeWriter keeps everything local:

- **Your stories stay on your server** - PouchDB/CouchDB database
- **Use local AI models** - Full Ollama integration means zero cloud dependency
- **Offline-first** - Works without internet, optional sync between devices
- **MIT licensed** - Truly open source

## Quick Start (Docker Compose)

    mkdir creativewriter && cd creativewriter
    mkdir -p data && chmod 755 data
    curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
    docker compose up -d

Access at `http://localhost:3080`

## Unraid Users

Install via **Docker Compose Manager** plugin - detailed guide in the repo. The compose file is ready for `/mnt/user/appdata/creativewriter/`.

## What Can It Do?

- **Story Structure** - Acts, chapters, scenes, beats
- **AI Writing Assistant** - Generate and expand scenes with context awareness
- **Character Codex** - Track characters, locations, plot elements
- **Multiple AI Providers** - OpenRouter, Gemini, or local Ollama
- **Rich Editor** - ProseMirror-based with inline images
- **Import/Export** - PDF export, NovelCrafter import

## Stack

- 6 containers (nginx, Angular app, CouchDB, proxies, snapshot service)
- ~500MB-1GB RAM
- Multi-arch images (AMD64/ARM64)

## Links

- **GitHub:** https://github.com/MarcoDroll/creativewriter-public
- **Docker Images:** https://github.com/MarcoDroll/creativewriter-public/pkgs/container/creativewriter-public
- **Unraid Guide:** https://github.com/MarcoDroll/creativewriter-public/blob/main/docs/unraid/README.md

Would love feedback from fellow selfhosters, especially on:
- Docker compose setup experience
- Ollama integration
- Any feature requests for the self-hosting crowd

Happy writing!

---

## Screenshots to Upload

Before posting, upload these screenshots to Reddit's gallery or create an Imgur album:

1. **Main Interface** - `docs/screenshots/Screenshot 2025-08-10 173755.png`
2. **AI Settings (showing Ollama)** - `docs/screenshots/Screenshot 2025-08-11 083512.png`
3. **Story Structure** - `docs/screenshots/Screenshot 2025-08-11 083614.png`
4. **Codex System** - `docs/screenshots/Screenshot 2025-08-11 083221.png`

### Screenshot Captions (for Reddit gallery)
1. Main writing interface with AI-powered beat assistant
2. Multiple AI provider support including local Ollama
3. Organize your story with hierarchical structure
4. Character and world-building codex with automatic context awareness

---

## Posting Tips

1. **Best times to post on /r/selfhosted:** Weekday mornings (US time zones) tend to get good visibility
2. **Flair:** Use "New Software" or similar if available
3. **Respond to comments:** Be ready to answer questions about:
   - Resource requirements
   - Ollama model recommendations (llama3.2, mistral, etc.)
   - Comparison with other writing tools
   - Backup/restore procedures
4. **Don't spam:** If it doesn't get traction, wait before reposting

---

## Alternative Shorter Version (if needed)

> **CreativeWriter - Self-hosted AI writing app**
>
> Open-source writing tool for fiction authors. Docker compose setup with local AI support (Ollama), offline-first database, Unraid template included.
>
> - GitHub: https://github.com/MarcoDroll/creativewriter-public
> - Quick start: `curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml && docker compose up -d`
