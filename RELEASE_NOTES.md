# Release Notes

> **PDF Export improvements with new export dialog and text truncation fix**

## Release Information
- **Commits**: 3 commits since last release
- **Key Areas**: PDF Export

## New Features

### PDF Export Dialog
- **Export Options Dialog** - New dialog shown before PDF export with customizable options
- **Background Image Control** - Choose whether to include the background image in exports (default: off for clean PDFs)
- **Page Format Selection** - Choose between A4 and Letter page formats
- **Orientation Options** - Select portrait or landscape orientation

## Bug Fixes

### PDF Export
- **Fixed text truncation** - Resolved issue where content in nested HTML structures was being cut off
- **Recursive DOM traversal** - PDF export now properly handles deeply nested content like `<div><p>text</p></div>`
- **Depth limit protection** - Added recursion depth limit (50 levels) to prevent stack overflow from malicious HTML
- **Improved error handling** - Replaced native browser alerts with Ionic AlertController for better UX

## Technical Improvements
- **Unit tests** - Added comprehensive unit tests for PDFExportDialogComponent (9 tests) and PDFExportService (15 tests)
- **Recursive content processing** - New `processNodeRecursively` method handles DIV, SECTION, ARTICLE, headings, and lists at any nesting level

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
