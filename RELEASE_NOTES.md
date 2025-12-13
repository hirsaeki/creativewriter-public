# Release Notes

> **Critical fix for local LLM streaming - Beat AI now works with LM Studio and other local providers**

## 📋 Release Information
- **Commits**: 2 commits since last release
- **Key Areas**: AI Streaming, Local LLM Support

## 🔧 Bug Fixes

### Beat AI - Local LLM Streaming
- 🐛 **Fixed Beat AI returning no content with local LLMs** - When using OpenAI-compatible local LLM providers (like LM Studio), the Beat AI feature would show the model generating content but nothing would appear in the editor. This was caused by SSE (Server-Sent Events) data being split across network chunks, with incomplete lines being silently discarded.

### Affected Services
- ⚡ **OpenAI-Compatible API** - Fixed streaming for LM Studio, LocalAI, and other OpenAI-compatible endpoints
- ⚡ **OpenRouter API** - Applied same fix for improved reliability under poor network conditions
- ⚡ **Ollama API** - Fixed streaming for local Ollama instances

## ✨ Improvements

### Local LLM Setup
- 📝 **Added Chrome Local Network Access warning** - New warning messages in OpenAI-Compatible and Ollama settings sections inform users about Chrome's Local Network Access restrictions that can block requests to localhost servers

## 🏗️ Technical Improvements
- **SSE Line Buffering**: Added proper buffer management to accumulate incomplete SSE lines across network chunks, preventing data loss when streaming responses are fragmented
- **Consistent Implementation**: Applied the same robust streaming pattern across all affected API services (matching the working Claude API implementation)

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
