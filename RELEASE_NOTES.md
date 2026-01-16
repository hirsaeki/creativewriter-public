# Release Notes

> **Major improvements to Beat AI, Image Generation, and universal AI model compatibility**

## 📋 Release Information
- **Commits**: 37 commits since last release
- **Key Areas**: Beat AI Rewrite System, Image Generation UX, Reasoning Models, Prompt System

## 🎯 New Features

### Beat AI Rewrite System
- 📝 **New Rewrite Modal** - Dedicated modal for beat rewriting with two distinct options:
  - "Rewrite Current" - Apply instruction to the current beat content
  - "Rewrite Original" - Re-apply instruction to the original stored text
- 🔄 **Persistent Rewrite Instructions** - Rewrite instructions are now saved and pre-populated when reopening the modal
- 💾 **Improved Version History** - Beat history now uses "save-before" approach, capturing content before any operation that changes it
- ⚡ **Simplified Regenerate Button** - Single regenerate button that always regenerates from original prompt

### Image Generation
- 🖼️ **Background Generation** - Generate up to 3 images concurrently in the background
- 🎯 **Floating Action Button** - Generate button converted to FAB for better mobile UX
- 📋 **Restore Settings** - New button on job history entries to restore all generation settings
- 🔄 **Collapsible Model Selector** - Model selection card auto-collapses after selection
- ❌ **Cancel Jobs** - Cancel in-progress image generation jobs

### AI Model Support
- 🧠 **Reasoning Model Variants** - OpenRouter models now have "(Reasoning)" variants that enable extended thinking
- ⚡ **Dynamic Reasoning Tokens** - Reasoning budget scales dynamically based on output size (1:1 ratio)
- 🌐 **Universal Prompt Format** - New Markdown-based prompt system works with all AI models (Claude, GPT, Gemini, Ollama)

### Developer Tools
- 🧪 **Test Story Generator** - New tool in Database Maintenance to generate complete test stories with chapters, scenes, beats, and codex entries

## ✨ Improvements

### Prompt System
- 📝 **Markdown Format** - Replaced XML message tags with cleaner Markdown delimiters
- 🏷️ **Codex renamed to Glossary** - Better reflects its purpose in AI prompts
- 🧹 **Cleaner Context** - Removed duplicate XML wrappers and unnecessary headings

### Image Generation UX
- 📱 **Sticky Generate Button** - Always accessible regardless of scroll position
- 🏷️ **Better Model Names** - Intelligent derivation of model names from fal.ai endpoint IDs
- 🛡️ **Sanitized Error Messages** - HTML error pages (like Cloudflare 504) now show clean messages

### Provider Icons
- 🎨 **Inline SVG Rendering** - Fixed missing custom icons by rendering SVGs inline

## 🔧 Bug Fixes

### Beat AI
- 🔄 **Rewrite Prompt Preservation** - Original beat prompt no longer overwritten during rewrite operations
- 💾 **State Persistence** - lastAction and rewriteContext now properly saved and restored
- ⚡ **Generation State Sync** - Fixed regenerate button not appearing after generation completes
- 📜 **History on Delete** - Deleted content is now saved to version history for recovery

### API & Models
- 🔢 **Reasoning Token Limits** - Fixed OpenRouter constraint requiring reasoning.max_tokens < total max_tokens
- 🧹 **Codex Metadata** - Import metadata fields excluded from AI prompt context

### Image Generation
- 🚫 **Ghost Jobs** - Interrupted jobs properly marked as failed on app reload

## 🏗️ Technical Improvements
- **Refactoring**: NodeView update() made fully stateless for reliability
- **Testing**: Added comprehensive tests for ProviderIconComponent and beat-ai features
- **Code Quality**: Consistent 'regenerate' action type across all services
- **Maintenance**: Updated copyright year, removed redundant AGENTS.md

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
