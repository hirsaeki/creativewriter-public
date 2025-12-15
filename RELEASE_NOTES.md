# Release Notes

> **Major sync stability release with improved AI features and better custom model support**

## 📋 Release Information
- **Commits**: 37 commits since last release
- **Key Areas**: Sync & Database, Beat AI, Token Analysis, Story Editor

## 🎯 New Features

### AI Writing Assistant
- ✨ **Improve Expression** - New quick prompt option in the AI rewrite modal lets you instantly enhance your writing style with one click

### CI/CD Infrastructure
- 🚀 **Cloudflare Cache Purge** - Build workflows now automatically purge Cloudflare cache on deploy, ensuring users always get the latest version

## ✨ Improvements

### Token Analysis & Custom Models
- 📊 **Accurate Context Display** - Custom models now show their actual context size instead of generic defaults
- 🏷️ **Real Model Names** - Token analysis displays the actual model name instead of showing "Custom Model Unknown"
- ⚙️ **Flexible Model Mapping** - Removed hardcoded model mappings for better support of new and custom AI models

### Sync Performance
- ⚡ **Faster Startup** - Sync now fetches only the metadata index on startup instead of scanning all documents
- 🔄 **Smarter Filtering** - New blacklist approach for sync filtering is more future-proof and handles new document types automatically
- 📝 **Character Chat Sync** - Added proper sync support for character chat sessions

## 🔧 Bug Fixes

### Sync & Database Stability
- 💾 **Metadata Index Reliability** - Fixed multiple issues with the metadata index:
  - Prevents sync loops by skipping unchanged saves
  - Prevents concurrent calls that could cause race conditions
  - Auto-rebuilds stale remote index when needed
  - Properly saves to remote on story create/update
- 🔄 **Story Delete Sync** - Fixed race conditions and proper cleanup when deleting stories:
  - Resolves metadata index conflicts on delete
  - Properly removes metadata from remote database
  - Handles delete for stories not yet synced locally
- 🔄 **Sync Initialization** - Sync now waits for user auth choice before initializing, preventing premature connection attempts
- 🔄 **Bootstrap Fallback** - Fixed fallback to bootstrap sync when metadata index is missing on remote

### Beat AI & Editor
- 🔄 **Beat Regeneration Fix** - Resolved race condition that could cause beat regeneration to fail or produce inconsistent results
- ✏️ **Save Race Condition** - Fixed a critical race condition in saveStory() that was causing beat regeneration failures
- 📅 **Beat History Dates** - Fixed date display in beat version history (dates were showing as strings instead of formatted dates)

### Story List
- 📱 **Navigation Fix** - Prevented sync loop when navigating back from story editor to story list
- 🚫 **Removed Missing Stories Banner** - Removed misleading "missing stories" feature that caused confusion

## 🏗️ Technical Improvements

### Architecture
- **Metadata Index Rewrite** - Completely refactored metadata index service with better conflict resolution and remote sync
- **Sync Service Refactor** - Query metadata index directly from remote database for more reliable sync status
- **Story List Cleanup** - Removed unused "missing stories" detection feature to simplify codebase

### Testing
- **Save Service Tests** - Added comprehensive unit tests for concurrent save race condition handling

## 📝 Documentation
- Streamlined Docker setup instructions, removing outdated development steps
- Added /r/selfhosted Reddit promotion post draft

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
