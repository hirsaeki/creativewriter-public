# Changelog

All notable changes to CreativeWriter 2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-08-18

### Added
- **Release Automation**: Comprehensive release preparation scripts with automatic version bumping and release notes generation
- **Claude Agent Configuration**: Simple agent config for automated release management
- **Beat AI UI Enhancements**: 
  - Colored icons for Beat AI buttons (generate, preview, cancel)
  - Magic wand icon for Generate button
  - Red cross icon for Cancel button
  - Pen icon for text generation
- **Sync State Management**: Disable Beat AI buttons during synchronization to prevent conflicts

### Fixed
- **Beat AI Button States**: Updated button disabled conditions for sync vs save operations
- **Token Analysis**: Improved model detection using metadata for better token counting
- **Beat AI Delete Button**: Made delete button always visible and active for better UX

### Changed
- **UI Localization**: Translated sync logs from German to English for consistency
- **Documentation**: Added environment variables section and critical storage warnings to Getting Started guide

### Security
- Added comprehensive code review with security analysis capabilities

## [1.1.0] - 2025-08-16

### Added
- **Database Backup & Restore**: Complete database backup and restore functionality with proper attachment handling
- **PDF Export Progress Indicator**: Visual progress indicator for PDF exports, especially helpful for large stories
- **Modern Button Styling**: Redesigned beat input buttons with modern glass-like styling and distinctive colored glows

### Fixed
- **Sync Error Handling**: Improved error handling to prevent JSON parsing errors when CouchDB is unreachable
  - Now shows user-friendly error messages instead of raw technical errors
  - Properly handles HTML error pages returned by the server
- **PDF Export Validation**: Enhanced error handling and validation for PDF exports with fallback mechanisms
- **Import Busy Indicator**: Fixed issue where import busy indicator wouldn't stop properly
- **Database Attachment Handling**: Resolved attachment stub errors during database backup/restore operations
- **Button Icon Visibility**: Fixed Ionic icon visibility issues in beat input buttons

### Changed
- **Button Design**: Modernized beat input buttons with 2025 design trends
  - Flattened button styling to remove 3D effects
  - Added distinctive colored glows for generate, preview, and cancel buttons
  - Increased transparency and neutralized button colors
  - Enhanced hover effects with premium glass-like styling

### Removed
- **DB Maintenance Export**: Removed redundant export functionality from DB maintenance tab (now handled by dedicated backup feature)
- **CI/CD Workflows**: Removed CI and PR validation workflows to streamline development

## [1.0.0] - 2025-08-14

### Initial Release
- Core story writing and management features
- AI integration for creative writing assistance
- Scene and beat organization
- Character codex management
- Story structure visualization
- Real-time sync with CouchDB
- Import/export capabilities
- Theme customization
- Multi-platform support (Web, Desktop via Electron)