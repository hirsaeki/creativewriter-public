# Release Notes

> **NovelCrafter import fix - all scene content now imports correctly**

## 📋 Release Information
- **Commits**: 1 commit since last release
- **Key Areas**: NovelCrafter Import

## 🔧 Bug Fixes

### NovelCrafter Markdown Import
- 🐛 **Fixed scene content import bug** - Resolved critical issue where only the first scene's narrative content was imported from NovelCrafter markdown exports (Closes GitHub Issue #9)
  - All scenes after the first one now correctly import their content
  - Scene separators (`* * *`, `***`, `---`, `___`) are properly handled
  - Content no longer incorrectly goes to the summary field
  - Supports Act/Part/Chapter hierarchies from NovelCrafter exports

## 🏗️ Technical Improvements
- **Unit tests** - Added 12 comprehensive unit tests for NovelCrafter import service covering:
  - Multiple scene separator formats
  - Multi-chapter documents with multiple scenes each
  - Content placement verification (content vs summary fields)
  - Paragraph break preservation
  - Edge cases (empty scenes, documents without chapters)

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
