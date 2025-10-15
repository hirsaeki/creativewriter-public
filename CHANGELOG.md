# Changelog

All notable changes to CreativeWriter 2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-15

### Major New Features

#### 🎯 AI-Powered Scene Generation from Outline
- **Generate Entire Scenes from Outline**: Create full scenes automatically from chapter/scene summaries
- **Iterative Generation**: Build long scenes (up to 25,000 words) through intelligent continuation
- **Customizable Templates**: Configure scene generation prompts in settings
- **Progress Tracking**: Real-time progress indicators with word count and segment tracking
- **Cancellation Support**: Cancel generation mid-process with keep/discard prompts
- **Context-Aware**: Optionally include story context, codex, and previous scene summaries

#### 📊 Story Inspector & Analysis Tools
- **Cliché Analyzer**: AI-powered detection of clichés and overused phrases per scene
- **Character Consistency Analyzer**: Check character voice and trait consistency across scenes
- **Multi-Provider Support**: Use any configured AI provider (OpenRouter, Claude, Gemini, Ollama)
- **Persistent State**: Analysis results and selections saved per story
- **Editor Integration**: Jump directly to findings in the editor with highlight flash
- **Scene Selection**: Analyze specific scenes or entire story
- **Progressive Results**: Real-time UI updates as each scene is processed

#### 📋 Story Outline Overview
- **Comprehensive Story View**: New accordion-based outline with all chapters and scenes
- **Inline Editing**: Edit chapter/scene titles and summaries directly in outline
- **AI Generation**: Generate titles and summaries for chapters/scenes from outline view
- **Search & Filter**: Quick search across structure with filtering options
- **Navigation**: Click any scene to jump to editor
- **Mobile Optimized**: Responsive design with sticky toolbar and floating action buttons
- **Auto-Scroll**: Automatically scroll to and expand current scene

#### 💬 Enhanced Scene Chat
- **Chat History Management**: Maintain up to 5 chat histories per story with easy switching
- **Message Editing**: Edit past user messages and branch conversations
- **Resend Messages**: Resend user messages with modifications
- **Session Guards**: Confirm before starting new chat to prevent accidental loss
- **History List UI**: Modal interface to view and switch between chat sessions
- **Auto-Save & Restore**: Automatic persistence and restoration of latest chat

### Added

#### Beat AI & Writing Assistance
- **Model Favorites**: Configure and manage favorite models per feature (beats, summaries, rewriting)
- **Quick Model Selection**: Segmented control UI for fast model switching
- **Prompt Persistence**: Beat AI prompts now persist immediately to prevent data loss
- **Collapsible Prompts**: Hide/show beat AI prompt section for cleaner interface
- **Remove Button**: Easily remove beat inputs with dedicated button
- **Keyboard Improvements**: Better keyboard handling in beat input controls

#### Scene Generation & Templates
- **Template Parsing**: Robust template validation and parsing for scene generation
- **Overlap Detection**: Prevents content duplication in iterative generation
- **Language Support**: Generate scenes in configured story language
- **Codex Integration**: Include codex entries in scene generation context

#### Model Selection & Configuration
- **Universal Model Selector**: Reusable model selector component across features
- **Per-Feature Selection**: Choose different models for different tasks
- **Provider Icons**: Visual provider branding (OpenRouter, Claude, Gemini, Ollama)
- **Model Quick Picks**: Fast access to frequently used models

#### Story Research & Planning
- **Story Research Workflow**: New research feature for story development
- **Parallel Processing**: Concurrent scene research with configurable concurrency
- **Localized Prompts**: Research prompts respect story language settings

#### Scene Summaries
- **Codex Context**: Include relevant codex entries in scene summaries
- **Word Count Directives**: Configurable target summary length
- **Language Awareness**: Summaries generated in story language
- **Scaling Logic**: Summary length scales with scene length
- **Favorites Support**: Manage favorite models for summary generation

#### User Interface Enhancements
- **Image Viewer Modal**: New lightbox-style image viewer with video controls
- **Zoom Controls**: Per-image zoom capabilities in viewer
- **Model FAB Menu**: Redesigned floating action button for model selection
- **Filter Improvements**: Enhanced outline filters optimized for mobile
- **Sticky Toolbar**: Keep model selector visible while scrolling
- **FAB Visibility Toggle**: Show/hide toolbar with floating action button

#### Mobile Experience
- **Comprehensive Debug System**: Mobile crash debugging and error tracking
- **Memory Warnings**: IndexedDB and memory optimization alerts
- **Mobile Debug Console**: Accessible from settings for troubleshooting
- **Safe Area Handling**: Proper handling of Android navigation bars throughout app
- **Keyboard Positioning**: Fixed keyboard issues on mobile devices
- **Touch Optimization**: Improved touch targets and scrolling behavior
- **Fade Indicators**: Visual cues for scrollable content on mobile

#### Database & Performance
- **Module Preloading**: Eliminate PouchDB lazy loading delays
- **Quick-Win Optimizations**: Targeted performance improvements for database operations
- **Memory Leak Fixes**: Resolved subscription leaks across components
- **Cache Busting**: Comprehensive cache strategy for updates
- **ESM Migration**: Migrated from CommonJS to ES modules for better optimization

#### Testing & Quality
- **ProseMirror Tests**: Comprehensive test coverage for editor service
- **Line Break Tests**: Tests for line break preservation functionality
- **Token Counter Tests**: Async token counter result handling

### Fixed

#### Beat AI & Editor
- **Regenerate Issues**: Fixed regenerate button deleting adjacent beat inputs
- **Context Refresh**: Properly refresh prompt context after regenerate
- **Sequential Operations**: Improved workflow sequencing for beat operations
- **Delete Scope**: Limited delete action to next beat only
- **Streaming Fragments**: Handle entity fragments in streaming responses
- **HTML Entities**: Properly decode provider HTML entities
- **Prompt Edits**: Immediate persistence of prompt edits

#### ProseMirror Editor
- **Memory Leaks**: Fixed memory leaks and improved nested editor management
- **Line Break Preservation**: Preserve line breaks in beat input
- **Selection Issues**: Improved text selection and manipulation

#### Mobile Interface
- **Keyboard Handling**: Fixed stuck input fields and positioning issues
- **Safe Area Padding**: Proper padding for device safe areas throughout app
- **Scrolling**: Fixed scroll compatibility with Ionic components
- **FAB Positioning**: Adjusted floating action button height for accessibility
- **Modal Footers**: Fixed footer visibility on Android devices
- **Codex Modals**: Improved modal actions visibility and padding
- **Scene Chat Footer**: Better footer handling with Android nav bars
- **Model Quick Picks**: Fixed mobile responsiveness of model selection UI
- **Beat Input Layout**: Optimized mobile layout for beat controls
- **Favorite Chips**: Made scrollable to prevent overflow on mobile

#### Story Structure & Navigation
- **Scene Deletion**: Allow deleting last scene with robust fallback selection
- **View Refresh**: Properly refresh after deleting scenes/chapters
- **Active Item Handling**: Reselect appropriate fallback when active item removed
- **Accordion State**: Preserve state after AI generation
- **Story Reload**: Reload story when navigating between stories
- **Space/Enter Keys**: Prevent input key events from collapsing/expanding tree

#### Scene Summaries & Titles
- **HTML Stripping**: Remove HTML and Beat AI nodes from content in prompts
- **Language Enforcement**: Ensure summaries follow story language setting
- **Word Count Handling**: Proper numeric handling of word count overrides
- **Target Scaling**: Scale summary target beyond base word count
- **Prompt Newlines**: Correct newline handling in scene summary prompts

#### Sync & Database
- **Progress Feedback**: Enhanced user feedback with progress tracking
- **Error Handling**: Surface manual sync progress and failure states
- **Favorites Persistence**: Reflect summary favorites as unsaved changes
- **Beat Favorites**: Persist beat model favorites with story

#### Image & Media
- **Upload Errors**: Surface detailed image upload error messages
- **Preview Refresh**: Restore image preview after file selection
- **Processing Indicator**: Show indicator during image insert
- **ArrayBuffer Fallback**: Add fallback for image uploads
- **Lightbox Closing**: Allow proper closing of image lightbox
- **Video Modal State**: Refresh video modal state instantly

#### Story Inspector
- **Scene Selection**: Require explicit scene selection before analysis
- **Mobile Spacing**: Improved spacing between model selector and buttons
- **JSON Parsing**: Robust extraction handling code fences and brackets
- **OnPush Updates**: Proper change detection with NgZone and markForCheck
- **Model Selection**: Avoid resetting selected model during operations
- **State Management**: Analyzing state properly resets after completion

#### UI & Display
- **Word Count Display**: Fixed word count exclusion for Beat AI content
- **Stats Alignment**: Aligned structure sidebar word counts
- **Icon Registration**: Added missing icon registrations
- **Textarea Scrolling**: Enabled scrolling in codex and summary editors
- **Summary Height**: Increased minimum height for summary editors
- **Horizontal Scroll**: Fixed horizontal scrolling on mobile settings

#### Docker & Infrastructure
- **Nginx Configuration**: Runtime DNS resolution for Docker services
- **Regex Patterns**: Properly quote patterns to prevent parsing errors
- **Cache Busting**: Trigger rebuilds to fix corrupted images
- **Config Source**: Clarified nginx config source and cache busting

### Changed

#### Architecture & Code Organization
- **ESM Modules**: Migrated from CommonJS to ESM for PouchDB
- **Component Structure**: Migrated UI components to `src/app/ui` directory
- **Error Handling**: Provide GlobalErrorHandlerService via standalone app config
- **Module Organization**: Removed unused CoreModule
- **Settings Components**: Split settings into smaller, focused modules

#### Prompt & Context Management
- **Beat Templates**: Use story Beat Generation template for scene prompts
- **Context Building**: Pull full context from story settings
- **Template Parsing**: Parse templates into provider messages
- **Codex Extraction**: Enriched codex extraction prompts
- **Field Mapping**: Map extraction fields to codex entries

#### UI/UX Refinements
- **Model Selection**: Consistent model selector across all features
- **Button Styling**: Updated beat favorites and action button styles
- **Chip Display**: Compact comma-separated text for model favorites
- **Accordion Styling**: Transparent glassy styling for outline components
- **Card Design**: Applied transparent styling to scene cards
- **Action Buttons**: Increased padding and improved layout

#### Settings & Configuration
- **Scene Generation**: Dedicated settings tab for scene generation
- **Summary Settings**: Removed word count override in favor of scaling
- **Model Favorites**: New configuration page for favorite models
- **Concurrency Control**: Expose research concurrency settings

### Technical Improvements
- **OnPush Strategy**: Implemented for major components to improve performance
- **Change Detection**: Proper use of NgZone and ChangeDetectorRef
- **Signal Support**: Converted critical state to signals for reactivity
- **Type Safety**: Improved typing throughout codebase
- **Component Isolation**: Better separation of concerns across components

### Documentation
- **AGENTS.md**: Added documentation for AI agent usage
- **Release Process**: Refined deployment and release documentation
- **Issue Tracking**: Added maintainer replies for public issues
- **Community Updates**: Reddit update templates and screenshots
- **Improvement Audit**: Added 2025 improvement audit with priorities

### Removed
- **CommonJS**: Removed CommonJS modules in favor of ESM
- **CDN Dependencies**: Bundled PouchDB via ESM imports instead of CDN
- **Obsolete Code**: Removed unused imports and components
- **Fallback Logic**: Removed automatic template update fallbacks

## [1.4.0] - 2025-09-01

### Added
- **Language Selection UI**: New Action Sheet interface replacing Modal for better mobile compatibility
- **Login Dialog Enhancement**: Clearer explanation of local-only mode functionality
- **Multilingual AI Support**: AI story generation now supports multiple languages with dedicated template files
- **German Category Support**: Added German language categories with auto-migration to English
- **Character Field Auto-Creation**: Automatic creation of character-specific fields in codex based on category
- **Performance Optimizations**: 
  - Implemented OnPush change detection strategy for major components
  - Migrated from CommonJS to ESM modules for better optimization
  - Added image compression and lazy loading for mobile devices

### Fixed
- **Local-Only Mode**: Now persists across page reloads
- **Language Selection Dialog**: Multiple fixes for proper display and interaction on mobile devices
- **Tag Management**: Prevented tag array mutation and duplication in codex entries
- **Custom Fields Storage**: Standardized metadata storage for custom fields
- **Template Updates**: Removed automatic template updates in story settings to prevent data loss

### Changed
- **Language Selection Dialog**: Refactored into separate component files for better maintainability
- **System Messages**: Enhanced with detailed fiction writing guidelines for better AI output
- **Database Operations**: Optimized saveToDatabase efficiency while preventing tag duplication
- **Documentation**: Updated README to reference public repository for development

### Technical Improvements
- Reduced CSS file sizes across multiple components
- Improved character category detection for auto-field creation
- Enhanced real-time codex updates without tag mutation

## [1.3.0] - 2025-08-21

### Added
- **Claude API Integration**: Full integration of Claude as an AI provider with dynamic model loading
- **Provider Branding**: Official logos for all AI providers (Claude, OpenRouter, Replicate, Ollama)
- **UI Improvements**: 
  - Collapsible AI provider settings cards
  - Enhanced provider icon clarity and recognition
  - Larger header logo for better visibility
- **Infrastructure**: Custom CouchDB Docker image with embedded configuration

### Fixed
- **Claude API**: Resolved CORS issues with proxy configuration
- **UI Elements**: 
  - Fixed chevron icon visibility in settings cards
  - Resolved missing Ionicons console warnings
  - Fixed logo truncation and display issues
- **Sync Issues**: Increased nginx and CouchDB limits for large document sync
- **Database**: Added CouchDB system database initialization

### Changed
- **Code Structure**: 
  - Modularized large prosemirror-editor service
  - Split settings component into smaller modules

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