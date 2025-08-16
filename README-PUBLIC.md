# CreativeWriter 2 - Self-Hosted Version

> **⚠️ Early Development Version:** This is a very early version in active development. Expect bugs, missing features, and frequent changes. Use at your own risk and consider it experimental software.

> **📢 This is the public release repository for self-hosters**
> 
> This repository is automatically synced from the main development repository and contains the latest version of CreativeWriter 2.

> **🐳 Docker Images Status:** All Docker images are now published and ready to use! No local building required.

[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen)](https://github.com/MarcoDroll/creativewriter-public)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/MarcoDroll/creativewriter-public)](https://github.com/MarcoDroll/creativewriter-public/releases)

## 📚 Table of Contents

- [☕ Support the Developer](#-support-the-developer)
- [🚀 Quick Start for Self-Hosters](#-quick-start-for-self-hosters)
  - [Zero-Configuration Deployment](#zero-configuration-deployment)
  - [Alternative: Build Locally (Optional)](#alternative-build-locally-optional)
  - [Multiple Instances](#multiple-instances)
- [📦 Docker Images](#-docker-images)
- [🔧 Configuration](#-configuration)
- [📋 Requirements](#-requirements)
- [🆘 Support & Issues](#-support--issues)
- [📄 License](#-license)
- [🤖 Built with AI-Powered Development](#-built-with-ai-powered-development)

## ☕ Support the Developer

Enjoying CreativeWriter? Consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support%20development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/nostramo83)

Your support helps keep this project free and open-source for the self-hosting community!

## 🚀 Quick Start for Self-Hosters

> **⚠️ CRITICAL - Data Persistence:** The database MUST have a persistent volume mount to preserve your stories. **Without proper volume mounting, you WILL lose all your data when the container restarts!** Always ensure the `./data` directory exists and is properly mounted.

### Zero-Configuration Deployment

1. **Create directories for the app and persistent data storage**
   ```bash
   mkdir creativewriter && cd creativewriter
   mkdir -p data  # IMPORTANT: This directory will store your database
   chmod 755 data
   curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
   ```

2. **Start the application with persistent storage**
   ```bash
   docker compose up -d
   ```

4. **Access your instance**
   ```
   http://localhost:3080
   ```

5. **Configure AI providers in Settings**
   - Add your OpenRouter, Google Gemini, or Replicate API keys
   - Start writing with AI assistance!

### Alternative: Build Locally (Optional)
If you prefer to build images yourself:
```bash
git clone https://github.com/MarcoDroll/creativewriter-public.git
cd creativewriter-public
docker build -t ghcr.io/marcodroll/creativewriter-public:latest .
docker build -t ghcr.io/marcodroll/creativewriter-public-nginx:latest -f Dockerfile.nginx .
docker build -t ghcr.io/marcodroll/creativewriter-public-proxy:latest -f Dockerfile.proxy .
docker build -t ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest -f Dockerfile.gemini-proxy .
docker compose up -d
```

### Multiple Instances

Run multiple isolated instances on the same host:

```bash
# Instance 1 - Personal Writing
mkdir writer-personal && cd writer-personal
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
echo "PORT=3080" > .env
docker compose -p writer-personal up -d

# Instance 2 - Work Projects (different directory)
mkdir ../writer-work && cd ../writer-work
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
echo "PORT=3081" > .env
docker compose -p writer-work up -d
```

## 📦 Docker Images

> **✅ All Images Published:** Complete set of pre-built images available on GitHub Container Registry.

| Image | Status | Pull Command |
|-------|--------|--------------|
| Main Application | ✅ Published | `docker pull ghcr.io/marcodroll/creativewriter-public:latest` |
| Nginx Proxy | ✅ Published | `docker pull ghcr.io/marcodroll/creativewriter-public-nginx:latest` |
| Replicate Proxy | ✅ Published | `docker pull ghcr.io/marcodroll/creativewriter-public-proxy:latest` |
| Gemini Proxy | ✅ Published | `docker pull ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest` |

All images are automatically built and published for multiple architectures (AMD64 + ARM64).

## 🔧 Configuration

### Environment Variables (.env file)
```bash
# Port for this instance
PORT=3080

# Data storage path
DATA_PATH=./data

# Timezone
TZ=Europe/Berlin

# CouchDB credentials (change for production)
COUCHDB_USER=admin
COUCHDB_PASSWORD=password
COUCHDB_SECRET=mysecret
```

### API Keys
Configure your AI provider API keys directly in the application:
- **Settings > AI Providers** 
- No environment variables needed for API keys
- Each instance maintains separate settings

## 📁 Data Persistence & Backup

**Your stories are stored in CouchDB.** The docker-compose.yml maps these critical volumes:

```yaml
volumes:
  - ./data/couchdb-data:/opt/couchdb/data     # Database files
  - ./data/log/couchdb_log:/opt/couchdb/var/log  # Log files
```

### Best Practices for Data Safety:

1. **Always use volume mounts** - Never run without the `./data` directory
2. **Regular backups** - Copy the entire `./data` directory to a backup location
3. **Verify persistence** - After first run, confirm `./data/couchdb-data` contains database files
4. **Use built-in backup** - Access Settings → Backup & Restore for downloadable backups
5. **Custom storage location**:
   ```bash
   echo "DATA_PATH=/your/backup/location" >> .env
   docker compose up -d
   ```

## 📋 Requirements

- **Docker & Docker Compose**
- **500MB-1GB RAM** per instance
- **Persistent storage** for database (minimum 100MB, grows with usage)
- **Available port** (default: 3080)
- **API Keys** for AI providers (optional but recommended)

## 🆘 Support & Issues

- **Issues**: [Report problems here](https://github.com/MarcoDroll/creativewriter-public/issues)
- **Documentation**: [Full documentation](https://github.com/MarcoDroll/creativewriter-public)
- **Discussions**: [Community discussions](https://github.com/MarcoDroll/creativewriter-public/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤖 Built with AI-Powered Development

This application was developed using AI-powered pair programming with [Claude Code](https://claude.ai/code), showcasing the future of software development through human-AI collaboration.

**Important Note:** While AI significantly accelerates development, creating production-ready applications like CreativeWriter still requires:
- 💰 **Investment**: Paid Claude subscription for development
- 🧠 **Expertise**: Deep software engineering knowledge to guide the AI
- ⏱️ **Time & Effort**: Many hours of focused human-AI collaboration
- 🎯 **Vision**: Clear architectural decisions and quality standards

The AI is a powerful tool, but the human developer's expertise, creativity, and effort remain essential for creating quality software.

---

**⚡ Ready to start writing? Deploy in under 2 minutes with the commands above!**