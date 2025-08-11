# CreativeWriter 2 - Self-Hosted Version

> **⚠️ Early Development Version:** This is a very early version in active development. Expect bugs, missing features, and frequent changes. Use at your own risk and consider it experimental software.

> **📢 This is the public release repository for self-hosters**
> 
> This repository is automatically synced from the main development repository and contains the latest version of CreativeWriter 2.

> **🐳 Docker Images Status:** Pre-built images are being set up. Please build locally for now (see instructions below).

[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen)](https://github.com/MarcoDroll/creativewriter-public)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/MarcoDroll/creativewriter-public)](https://github.com/MarcoDroll/creativewriter-public/releases)

## ☕ Support the Developer

Enjoying CreativeWriter? Consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support%20development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/nostramo83)

Your support helps keep this project free and open-source for the self-hosting community!

## 🚀 Quick Start for Self-Hosters

### Build and Deploy Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/MarcoDroll/creativewriter-public.git
   cd creativewriter-public
   ```

2. **Build the Docker images**
   ```bash
   docker build -t ghcr.io/marcodroll/creativewriter-public:latest .
   docker build -t ghcr.io/marcodroll/creativewriter-public-nginx:latest -f Dockerfile.nginx .
   docker build -t ghcr.io/marcodroll/creativewriter-public-proxy:latest -f Dockerfile.proxy .
   docker build -t ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest -f Dockerfile.gemini-proxy .
   ```

3. **Start the application**
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

### Future: Zero-Configuration Deployment (Coming Soon)
Once pre-built images are available, you'll be able to:
```bash
mkdir creativewriter && cd creativewriter
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
docker compose up -d
```

### Multiple Instances

Run multiple isolated instances on the same host:

```bash
# Clone and build once
git clone https://github.com/MarcoDroll/creativewriter-public.git
cd creativewriter-public
docker build -t ghcr.io/marcodroll/creativewriter-public:latest .
docker build -t ghcr.io/marcodroll/creativewriter-public-nginx:latest -f Dockerfile.nginx .
docker build -t ghcr.io/marcodroll/creativewriter-public-proxy:latest -f Dockerfile.proxy .
docker build -t ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest -f Dockerfile.gemini-proxy .

# Instance 1
echo "PORT=3080" > .env
docker compose -p writer-personal up -d

# Instance 2  
echo "PORT=3081" > .env
docker compose -p writer-work up -d
```

## 📦 Docker Images

> **Status:** Pre-built images are being set up. Currently requires local building.

Images to build locally:
- `ghcr.io/marcodroll/creativewriter-public:latest` - Main application
- `ghcr.io/marcodroll/creativewriter-public-nginx:latest` - Nginx reverse proxy
- `ghcr.io/marcodroll/creativewriter-public-proxy:latest` - Replicate API proxy
- `ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest` - Gemini API proxy

Once available, these will be automatically published to GitHub Container Registry.

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

## 📋 Requirements

- **Docker & Docker Compose**
- **500MB-1GB RAM** per instance
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