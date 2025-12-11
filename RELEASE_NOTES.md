# Release Notes

> **Major update featuring Character Chat, Premium Subscriptions, AI Favorites management, and extensive sync improvements**

## 📋 Release Information
- **Commits**: 94 commits since last release
- **Key Areas**: Character Chat, Premium Features, AI Model Favorites, Sync & Database, Beat Generation, Story Settings

## 🎯 New Features

### 💬 Character Chat (Premium)
- 📝 **Interactive Character Conversations** - Chat with characters from your story in a dedicated UI
- 🔄 **Persistent Chat History** - Conversations are saved per character and persist across sessions
- ✏️ **Message Edit & Retry** - Edit your messages or retry AI responses for better results
- 🤖 **AI Model Selection** - Choose your preferred AI model directly in the chat interface
- 📊 **Story Context Awareness** - AI includes all scene summaries for contextually relevant responses
- 🌐 **Multi-language Support** - Suggested conversation starters display in your story's language

### ⭐ AI Model Favorites
- 🆕 **Dedicated AI Favorites Tab** - New tab in Story Settings to manage model favorites
- 🎹 **Quick Picks Support** - Favorite models appear as quick-select buttons in model dropdowns
- 📂 **Organized by Feature** - Separate favorites for Beat Input, Scene Summary, Rewrite, and Character Chat
- 🎨 **Accordion Layout** - Clean, responsive accordion design for better mobile experience

### 💎 Premium Subscription System
- 💳 **Stripe Integration** - Secure payment processing with Stripe Pricing Table
- 🔐 **Subscription Verification** - Automatic premium status verification on app startup
- ⚙️ **Premium Settings Tab** - Dedicated tab for subscription management
- 🌍 **Environment-based Configuration** - Separate dev/production API endpoints
- ☁️ **Cloudflare Worker Backend** - Serverless backend for subscription verification

### ✍️ Beat Generation Improvements
- 📝 **Reworked Scene Beat System** - Distinct instructions with improved bridging between beats
- 👁️ **Beat End Markers** - Visual indicators showing beat boundaries in editor
- 🎭 **Narrative Perspective (POV)** - Configure first-person, third-person limited/omniscient, or second-person POV
- 🆕 **POV Selection on Story Creation** - Set narrative perspective when creating new stories
- 📜 **Beat History Preservation** - Existing content saved to history before regeneration

## ✨ Improvements

### 🔄 Sync & Database
- ⚡ **Bootstrap Sync Mode** - Reliable story loading when metadata index is missing
- 🎯 **Active Remote Checking** - Proactively checks for remote stories instead of passive waiting
- 📊 **Improved Status Accuracy** - Better sync status display and loading state management
- ⏱️ **Extended Timeouts** - Hard timeout increased from 10s to 60s for large databases
- 🛡️ **Defensive Error Handling** - Better handling of undefined results and edge cases

### ⚡ Performance
- 🚀 **Pause Sync During Streaming** - Database sync paused during AI text streaming for smoother experience
- 🔧 **Reduced Change Detection** - Fewer change detection cycles during beat text streaming
- 🎯 **Shared Model Selector** - Refactored to use reusable component across features

### 📱 User Experience
- 🔙 **Consistent Back Navigation** - Story Settings uses app-header component for uniform navigation
- 📊 **Token Analysis Updates** - Improved accuracy and support for latest AI models
- 🔔 **Stale Chunk Detection** - Automatic detection prompting users to reload when app is outdated

## 🔧 Bug Fixes

### Sync & Database
- 🔧 **Fixed stale database reference** in StoryMetadataIndexService
- 🔧 **Resolved PouchDB document conflicts** in metadata index updates
- 🔧 **Fixed remote DB error handling** in missing stories check

### Editor & Content
- 🔧 **Fixed null state error** in codex highlighting plugin
- 🔧 **Fixed marker-aware delete** for beat regeneration
- 🔧 **Changed beat marker** from inline to block node for reliability
- 🔧 **Preserved pre-existing text** on regenerate operations
- 🔧 **Fixed codex sync** when loading stories

### Import & Export
- 🔧 **Improved NovelCrafter parsing** - More flexible markdown import handling

### UI/UX Fixes
- 🔧 **Fixed beat navigation** - Removed status badge and fixed scroll overflow
- 🔧 **Fixed missing ionicons** - Registered checkmark-done and information-circle icons
- 🔧 **Fixed premium navigation** - Navigate to premium tab from upsell dialog
- 🔧 **Fixed character chat buttons** - Show header action buttons on desktop view
- 🔧 **Fixed back navigation** - Correct navigation in character chat components

### Infrastructure
- 🔧 **Fixed Docker caching** - Added cache-busting for fresh Angular builds
- 🔧 **Fixed nginx chunk handling** - Return 404 for missing chunks instead of index.html
- 🔧 **Fixed CORS configuration** - Allow any origin for self-hosted apps

## 🏗️ Technical Improvements
- **Cloudflare Worker Backend** - New serverless backend for premium subscription verification
- **Dual Pricing Support** - Backend supports both monthly and yearly subscription plans
- **Refactored Model Selection** - Character chat uses shared ModelSelectorComponent
- **Removed Debug Logging** - Cleaned up all debug logs and alerts from beat system
- **CI/CD Improvements** - Added Wrangler deployment to GitHub workflows

## 📝 Documentation
- Comprehensive premium feature & character chat implementation plan
- Firebase migration research and planning documentation
- Updated CLAUDE.md with backend deployment reminders
- Repository cleanup removing outdated documentation and assets

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
