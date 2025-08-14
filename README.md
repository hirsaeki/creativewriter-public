# CreativeWriter 2

> **⚠️ Early Development Version:** This is a very early version in active development. Expect bugs, missing features, and frequent changes. Use at your own risk and consider it experimental software.

> **🔗 Self-Hosters: Looking for the public version? Visit [creativewriter-public](https://github.com/MarcoDroll/creativewriter-public) for easy deployment!**

A powerful, AI-enhanced creative writing application that helps authors craft compelling stories with intelligent assistance for plot development, character creation, narrative structure, and **rich media integration including images within text**.

> **🤖 Built with AI:** This entire application was developed using AI-powered pair programming with [Claude Code](https://claude.ai/code), demonstrating the power of human-AI collaboration in modern software development. While AI accelerates development, it still requires significant human expertise, effort, and a paid Claude subscription to guide the AI, make architectural decisions, and ensure quality.

![Angular](https://img.shields.io/badge/Angular-20-red)
![Ionic](https://img.shields.io/badge/Ionic-8-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 📚 Table of Contents

- [☕ Support the Project](#-support-the-project)
- [🎯 What is CreativeWriter?](#-what-is-creativewriter)
- [📷 Screenshots](#-screenshots)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Getting Started](#-getting-started)
- [🐳 Docker Deployment](#-docker-deployment)
- [📦 Docker Images](#-docker-images)
- [🛠️ Development](#️-development)
- [📝 Usage Tips](#-usage-tips)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📚 Documentation](#-documentation)

## ☕ Support the Project

If you find CreativeWriter helpful and want to support its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support%20development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/nostramo83)

Your support helps maintain and improve CreativeWriter for the community!

## 🎯 What is CreativeWriter?

CreativeWriter is a modern web-based writing tool designed for fiction authors who want to leverage AI technology to enhance their creative process. It combines traditional story structuring techniques with cutting-edge AI capabilities to help writers overcome creative blocks, develop rich narratives, and maintain consistency throughout their work.

## 📷 Screenshots

### Main Writing Interface
![Main Interface](docs/screenshots/Screenshot%202025-08-10%20173755.png)
*The main writing interface with AI-powered beat assistance and rich text editor*

### Story Structure Management
![Story Structure](docs/screenshots/Screenshot%202025-08-11%20083614.png)
*Organize your narrative with chapters and scenes in a hierarchical structure*

### Dynamic Codex System
![Codex System](docs/screenshots/Screenshot%202025-08-11%20083221.png)
*Intelligent character and world-building database with automatic context awareness*

### AI Configuration
![AI Settings](docs/screenshots/Screenshot%202025-08-11%20083512.png)
*Configure multiple AI providers including OpenRouter and Google Gemini*

### Custom Backgrounds
![Background Selection](docs/screenshots/Screenshot%202025-08-11%20083536.png)
*Choose from various atmospheric backgrounds to enhance your writing environment*

### Story Statistics
![Story Statistics](docs/screenshots/Screenshot%202025-08-11%20085427.png)
*Track your progress with detailed writing statistics and analytics*

### Beat Generation Templates
![Beat Templates](docs/screenshots/Screenshot%202025-08-11%20083657.png)
*Customize AI prompt templates for consistent story development*

## ✨ Features

> **🎉 Update:** All Docker images are now being published automatically!

### 📝 Story Management
- **Multi-Story Support**: Manage multiple writing projects simultaneously
- **Rich Text Editor**: Full-featured ProseMirror-based editor with formatting tools and **inline image support**
- **Story Structure**: Organize your narrative with acts, chapters, scenes, and beats
- **Auto-Save**: Never lose your work with automatic saving to local database
- **📸 Images Within Text**: Seamlessly embed images directly within your story text for enhanced storytelling

### 🤖 AI Integration
- **Multiple AI Providers**: Support for OpenRouter, Google Gemini, and **Ollama (Local LLMs)**
- **Local AI Support**: Connect to self-hosted models via Ollama for complete privacy
- **Real-time Streaming**: Live text generation with streaming responses
- **Beat AI Assistant**: Get intelligent suggestions for plot development
- **Scene Enhancement**: AI-powered scene expansion and refinement
- **Character Consistency**: Maintain character voice and traits with AI assistance
- **Custom Prompts**: Fine-tune AI behavior with customizable prompt templates

#### How CreativeWriter Feeds Context to AI
CreativeWriter uses a sophisticated context-building system when generating AI suggestions for beats. The system includes a standard prompt that defines the AI's role as a "creative writing assistant". Then it incorporates scene summaries (to reduce context size) from all previous scenes you've already written. You can either write the scene summary on your own, or let the AI create one for you. Additionally, you can choose to include the full text of specific scenes instead of the summary if you want; for example when you write a retrospective on a specific scene.

After the "story context", it includes the "codex" - all of your characters, items, and lore. The final part is the particular task for the next beat with additional instructions.

AI tends to "understand" XML-tags better than simple text as context structuring, so the system creates a pseudo-XML structure with this information in the prompt.

### 📚 Codex System
- **Dynamic Knowledge Base**: Automatically track characters, locations, and plot elements
- **Smart Context Awareness**: AI understands your story's universe
- **Relevance Scoring**: Intelligent filtering of relevant codex entries for each scene
- **Tag Management**: Organize codex entries with custom tags

### 🎨 Customization
- **Theme Support**: Dark and light modes
- **Custom Backgrounds**: Upload and manage custom backgrounds for your writing environment
- **Flexible Layouts**: Adjustable editor and panel configurations
- **Font Options**: Multiple font choices for comfortable reading and writing

### 🔄 Data Management
- **Local Database**: PouchDB/CouchDB for offline-first functionality
- **Import/Export**: Support for various formats including NovelCrafter projects
- **PDF Export**: Generate formatted PDFs of your stories
- **Version History**: Track changes and revisions

### 🖼️ Rich Media Support
- **📸 Images Within Text**: **Embed images directly within your story text** - perfect for visual storytelling, character references, or scene inspiration
- **Image Generation**: Integration with Replicate for AI image generation
- **Image Management**: Upload and manage story-related images with full editor integration
- **Video Support**: Embed and manage video content
- **Visual Storytelling**: Enhance your narrative with inline media that flows naturally with your text

## 🏗️ Architecture

CreativeWriter is built with modern web technologies:

- **Frontend**: Angular 20 with Ionic 8 for responsive UI
- **Editor**: ProseMirror for rich text editing
- **Database**: PouchDB with CouchDB sync capability
- **AI Services**: Modular integration with multiple AI providers
- **Deployment**: Docker containers with nginx reverse proxy

## 🚀 Getting Started

### Quick Start with Docker

> **🎉 All images are now published!** Use the simple docker-compose setup from the public repository.

#### Option 1: Use Pre-built Images (Recommended)
```bash
# No cloning required! Just download and run:
mkdir creativewriter && cd creativewriter
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
docker compose up -d

# Access at http://localhost:3080
```

#### Option 2: Development Setup (Local Build)
For development or customization:
```bash
git clone https://github.com/MarcoDroll/creativewriter2.git
cd creativewriter2

# Build all Docker images
docker build -t ghcr.io/marcodroll/creativewriter2:latest .
docker build -t ghcr.io/marcodroll/creativewriter2-nginx:latest -f Dockerfile.nginx .
docker build -t ghcr.io/marcodroll/creativewriter2-proxy:latest -f Dockerfile.proxy .
docker build -t ghcr.io/marcodroll/creativewriter2-gemini-proxy:latest -f Dockerfile.gemini-proxy .

docker compose up -d
```

Then configure your AI providers in Settings with your API keys.

### Development Setup

For development or customization, clone the repository:

1. **Clone and setup**
   ```bash
   git clone https://github.com/MarcoDroll/creativewriter2.git
   cd creativewriter2
   ```

2. **Prerequisites**
   - Node.js 20+
   - npm 10+
   - Angular CLI 19+

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start development server**
   ```bash
   npm start
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

### Configuration

#### AI Providers
Configure your AI providers in the application settings:
- **OpenRouter**: Add your API key for access to multiple models
- **Google Gemini**: Direct integration with Gemini models
- **Ollama (New!)**: Connect to local LLMs for complete privacy and offline usage
- **Custom Endpoints**: Support for self-hosted models

##### Ollama Setup (Local AI)
1. **Install Ollama**: https://ollama.com/
2. **Configure CORS** (required for web access):
   ```bash
   # Set environment variable to allow web access
   export OLLAMA_ORIGINS="*"
   # Or for more security, specify your CreativeWriter URL:
   # export OLLAMA_ORIGINS="http://localhost:3080"
   ```
   
   **Alternative methods:**
   - **Linux/macOS**: Add to `~/.bashrc` or `~/.zshrc`
   - **Windows**: Set via System Properties → Environment Variables
   - **Docker**: Add `-e OLLAMA_ORIGINS="*"` to your Ollama container
   - **Systemd**: Edit `/etc/systemd/system/ollama.service` and add `Environment="OLLAMA_ORIGINS=*"`

3. **Start Ollama** and run a model:
   ```bash
   ollama serve  # Start the server (if not auto-started)
   ollama run llama3.2  # Download and run a model
   ```

4. **Configure in CreativeWriter**:
   - Go to Settings → AI Providers → Ollama
   - Set URL (default: `http://localhost:11434`)
   - Test connection and select your model

**⚠️ CORS Troubleshooting:**
If you see "CORS" errors in browser console, ensure `OLLAMA_ORIGINS` is set correctly and restart Ollama.

#### Database
The application uses PouchDB for local storage with optional CouchDB sync:
- Local-only mode works out of the box
- For sync, configure CouchDB connection in settings

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- Git (for cloning the repository)
- ~500MB-1GB RAM per instance
- Port 3080 available (or configure a different port)

### Single Instance
Build and run locally:
```bash
git clone https://github.com/MarcoDroll/creativewriter2.git
cd creativewriter2
docker build -t ghcr.io/marcodroll/creativewriter2:latest .
docker build -t ghcr.io/marcodroll/creativewriter2-nginx:latest -f Dockerfile.nginx .
docker build -t ghcr.io/marcodroll/creativewriter2-proxy:latest -f Dockerfile.proxy .
docker build -t ghcr.io/marcodroll/creativewriter2-gemini-proxy:latest -f Dockerfile.gemini-proxy .
docker compose up -d
```
Then configure your AI API keys in Settings after accessing the app at http://localhost:3080.

### Multiple Instances
Run multiple isolated instances on the same host:

```bash
# Clone once
git clone https://github.com/MarcoDroll/creativewriter2.git creativewriter-base
cd creativewriter-base

# Build images once
docker build -t ghcr.io/marcodroll/creativewriter2:latest .
docker build -t ghcr.io/marcodroll/creativewriter2-nginx:latest -f Dockerfile.nginx .
docker build -t ghcr.io/marcodroll/creativewriter2-proxy:latest -f Dockerfile.proxy .
docker build -t ghcr.io/marcodroll/creativewriter2-gemini-proxy:latest -f Dockerfile.gemini-proxy .

# Instance 1 - Personal Writing
echo "PORT=3080" > .env
docker compose -p writer-personal up -d

# Instance 2 - Work Projects (using different port)
echo "PORT=3081" > .env
docker compose -p writer-work up -d
```

Each instance maintains its own database and settings, so configure API keys separately in each instance's Settings.

See [README-MULTI-INSTANCE.md](README-MULTI-INSTANCE.md) for detailed multi-instance setup.

## 📦 Docker Images

> **✅ All Images Available:** Complete set of pre-built Docker images ready for production use.

| Image | Status | Registry Path |
|-------|--------|--------------|
| Main Application | ✅ Published | `ghcr.io/marcodroll/creativewriter-public:latest` |
| Nginx Proxy | ✅ Published | `ghcr.io/marcodroll/creativewriter-public-nginx:latest` |
| Replicate Proxy | ✅ Published | `ghcr.io/marcodroll/creativewriter-public-proxy:latest` |
| Gemini Proxy | ✅ Published | `ghcr.io/marcodroll/creativewriter-public-gemini-proxy:latest` |

## 🛠️ Development

### Project Structure
```
src/
├── app/
│   ├── core/        # Core services and models
│   ├── shared/      # Shared components and utilities
│   ├── stories/     # Story management module
│   └── settings/    # Settings module
├── assets/          # Static assets and templates
└── styles.scss      # Global styles
```

### Key Technologies
- **Angular 20**: Modern web framework
- **Ionic 8**: UI components and mobile support
- **ProseMirror**: Powerful text editor framework
- **PouchDB**: Local-first database
- **RxJS**: Reactive programming
- **TypeScript**: Type-safe development

## 📝 Usage Tips

1. **Start with Story Structure**: Define your acts and chapters before diving into scenes
2. **Build Your Codex**: Add characters and locations early for better AI context
3. **Use Beat AI**: Let AI help with writer's block on individual beats
4. **📸 Leverage Visual Storytelling**: Embed images directly within your text to enhance scenes, character descriptions, or provide visual inspiration
5. **Customize Prompts**: Tailor AI responses to your writing style
6. **Regular Exports**: Backup your work regularly using export features

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Angular and Ionic frameworks
- AI integrations powered by OpenRouter, Google Gemini, and Ollama
- ProseMirror for the editing experience
- Developed using AI-powered pair programming with [Claude Code](https://claude.ai/code) (paid subscription)
- Significant human expertise and effort guiding the AI development
- Community contributors and testers

## 📚 Documentation

- [Multi-Instance Deployment](README-MULTI-INSTANCE.md)
- [Image Generation Setup](README-IMAGE-GENERATION.md)
- [Release Process](RELEASE.md)
- [API Documentation](docs/api.md)

## 🔗 Links

- [GitHub Repository](https://github.com/MarcoDroll/creativewriter2)
- [Issue Tracker](https://github.com/MarcoDroll/creativewriter2/issues)
- [Docker Images](https://github.com/MarcoDroll/creativewriter2/pkgs/container/creativewriter2)