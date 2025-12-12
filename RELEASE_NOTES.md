# Release Notes

> **Bug fix release addressing PDF export dialog rendering issue**

## 📋 Release Information
- **Commits**: 2 commits since last release
- **Key Areas**: PDF Export, UI Components

## 🔧 Bug Fixes

### PDF Export Dialog
- 🐛 **Fixed PDF export dialog not rendering content** - The PDF export options dialog was appearing empty with only the title and cancel button visible. This was caused by incorrect modal height settings and Ionic 8 compatibility issues with form bindings.

## 🏗️ Technical Improvements
- **Ionic 8 Compatibility**: Updated form bindings to use Ionic 8's recommended `[value]`/`[checked]` + `(ionChange)` pattern instead of `ngModel` for better standalone component compatibility
- **Modal Layout**: Added proper flexbox layout to ensure modal content renders correctly
- **Test Cleanup**: Removed unused `FormsModule` import from test file

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
