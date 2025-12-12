# Release Notes

> **New AI Provider: OpenAI-Compatible local servers (LM Studio, LocalAI, vLLM)**

## 📋 Release Information
- **Commits**: 2 commits since last release
- **Key Areas**: AI Providers, Settings UI

## 🎯 New Features

### OpenAI-Compatible Provider Support
- 🖥️ **Local AI Server Integration** - Connect to LM Studio, LocalAI, vLLM, text-generation-webui, and other OpenAI-compatible local servers
- ⚙️ **Simple Configuration** - Just enter your server's base URL (default: `http://localhost:1234` for LM Studio)
- 🔌 **Connection Test** - Built-in connection testing to verify your local server is accessible
- 📋 **Automatic Model Discovery** - Fetches available models from your local server via `/v1/models` endpoint
- 🌊 **Full Streaming Support** - Real-time streaming responses for beat generation and scene writing
- 🔧 **Customizable Parameters** - Configure temperature, top-p, and max tokens per your preference
- 🔓 **No API Key Required** - Designed for local servers that don't require authentication

### Settings UI Improvements
- 📝 **CORS Documentation** - Clear in-app instructions for enabling CORS in popular local servers:
  - LM Studio: Enable in Local Server settings
  - Ollama: Set OLLAMA_ORIGINS environment variable
  - Other servers: Links to documentation

## 🏗️ Technical Improvements
- **New Service**: `openai-compatible-api.service.ts` with full OpenAI API compatibility
- **Type Safety**: Updated provider types across model interfaces and request logging
- **Provider Routing**: Integrated into beat-ai and scene-generation services
- **Model Service**: Added model loading and context length estimation for common model families (Llama, Mistral, Qwen, Gemma, Phi)

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
