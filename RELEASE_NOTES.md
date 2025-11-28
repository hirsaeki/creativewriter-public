# 🚀 CreativeWriter v2.0 - Feature Release

> **Major update with AI Image Generation, Beat Version History, Enhanced Sync, and Mobile Improvements!**

## 📋 Release Information
- **Version**: v2.0.202511280702
- **Release Date**: November 28, 2025
- **130+ Commits** since v2.0.202510150738 with extensive new features, improvements, and fixes

## 🎯 Major New Features

### AI Image Generation
- 🖼️ **Generate images with AI** - New dedicated image generation feature powered by Replicate
- 🔍 **Searchable model selector** - Browse and filter thousands of text-to-image models
- 📊 **Pagination support** - Efficiently browse large model collections
- ⚙️ **Custom model IDs** - Manually enter any Replicate model identifier
- 🔄 **Dynamic model loading** - Fetch community models from Replicate search
- 🛡️ **Safety checker bypass** - Disabled for creative freedom

### Beat Version History
- 📜 **Version tracking** - Automatic history for all beat changes
- 🔄 **Restore previous versions** - Roll back to any saved state
- 🎨 **Theme-aware UI** - Version history modal matches app theme
- 💾 **Persistent storage** - History survives app restarts
- 🗑️ **Database maintenance** - UI for managing beat history storage
- ✏️ **Action type tracking** - Know if change was from generation, rewrite, or edit

### Enhanced Sync & Data Management
- 🔄 **Selective sync** - Only sync active story for faster performance
- 📊 **Metadata index** - Optimized story list loading with 5-phase implementation
- 📱 **Device tracking** - See sync history across devices
- ⚡ **Granular progress** - Document-level sync indicators
- 🔔 **Auto-refresh** - Story list updates automatically after sync
- 🔍 **Missing stories check** - Detect and recover unsynchronized content

### Mobile Experience Improvements
- 👆 **Swipe navigation** - Access beat navigation panel with swipe gesture
- 📐 **Safe area handling** - Proper padding for Android navigation bars
- 🎯 **Fixed keyboard issues** - Resolved stuck input problems
- 📜 **Scroll improvements** - Better scrolling with Ionic components
- 🐛 **Debug console** - Mobile-accessible debugging from settings

## ✨ Additional Features

### Beat AI Enhancements
- ⭐ **Rewrite beat functionality** - AI-powered rewriting of existing beats
- 📝 **Truncated context** - Scene context truncated at beat position for relevance
- 💡 **Tooltips** - Helpful hints on truncated scene chips
- ⚡ **Grouped buttons** - Cleaner UI with related actions grouped together
- 🔄 **CO-STAR framework** - Restructured prompts using 2025 best practices

### Beat Navigation
- 🎯 **Vertical scrolling** - Improved beat-to-beat navigation
- 🔗 **Scroll-to-beat fixes** - Reliable positioning after rewrites
- 🎨 **Redesigned indicators** - Subtle, non-distracting edge indicators
- 🆔 **Legacy beat support** - Automatic ID migration for older stories

### Codex Transfer
- 📤 **Transfer UI** - Move codex entries between stories
- 📱 **Mobile-optimized modal** - Proper viewport handling on mobile
- 📚 **Help documentation** - Built-in transfer instructions

### Media & Content
- 🖼️ **Media gallery** - View all images and videos in a story
- 📋 **Story preview** - Excludes beat AI content from previews
- ⭐ **Favorite labels** - Improved beat AI favorite model labels

### Snapshots & Rollback
- 📸 **Server-side snapshots** - Docker-based snapshot service
- 🔄 **Filtered replication** - Efficient snapshot syncing
- 📜 **Timeline UI** - Visual snapshot history

## 🔧 Bug Fixes

### Editor & Story Management
- 💾 **Stale state fix** - Resolved data loss from stale saveStory state
- 🔄 **Double-save prevention** - Eliminated race condition in beat actions
- ✏️ **Cursor preservation** - Scroll and cursor position maintained in AI rewrite
- 📊 **Accordion state** - Preserved expanded state during save operations

### Sync & Database
- 🔄 **Initial sync timing** - Wait for sync before loading metadata
- 🛡️ **Empty index protection** - Prevent overwriting remote data
- 📊 **Story counting** - Correct logic for identifying story documents
- ⏱️ **Race condition fix** - Removed setTimeout preventing login issues
- 🗑️ **IndexedDB cleanup** - Automatic cleanup of old databases on mobile

### Mobile & UI
- 📱 **Header scroll fix** - Prevent header from scrolling out of view
- 🎯 **Viewport overlap** - Fixed overlap during beat editing
- 📐 **Modal heights** - Proper sizing for mobile viewports
- 👆 **Footer visibility** - Fixed missing buttons on Android

### API & Proxy
- 🔌 **Replicate proxy** - CORS-free API access configuration
- 🔗 **API path fixes** - Correct routing for Replicate endpoints
- 🌐 **Nginx proxy** - Preserved full request paths
- 🌐 **Browser compatibility** - Improved Vivaldi browser support

## 🏗️ Technical Improvements

### Architecture
- **Service splitting** - ProseMirrorEditorService split into logical sub-services
- **State management** - New SceneNavigationService and StoryEditorStateService
- **AI validation** - Centralized AI provider validation service

### Performance
- 🚀 **Caching** - Story preview and word count caching
- 📊 **Indexed queries** - Database query optimization
- ⚡ **Schema versioning** - Skip unnecessary migrations
- 🔄 **Simplified indexes** - Dramatic performance improvement with allDocs()

### Testing
- ✅ **Editor tests** - Comprehensive unit tests for sub-services
- ✅ **Beat navigation tests** - Attribute consistency verification
- 🔧 **Test fixes** - HttpClient providers and timing fixes

## 📝 Documentation
- 📚 **Beat history docs** - User guide and implementation specs
- 📊 **Performance docs** - Optimization plan and rollback documentation
- 🏗️ **Snapshot architecture** - Server-side service design docs
- 📋 **Progress tracking** - Comprehensive implementation progress documents

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
