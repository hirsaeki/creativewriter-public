# Release Notes

## New Features

- **image-gen**: Introduce image generation feature with dedicated service, component, and Replicate API integration
- **image-gen**: Add dynamic loading of text-to-image models from Replicate
- **image-gen**: Fetch all community models from Replicate search
- **image-gen**: Add searchable/filterable model selection dropdown
- **image-gen**: Implement pagination and multiple search queries
- **image-gen**: Replace dropdown with searchable model selector
- **image-gen**: Add ability to manually enter custom model IDs
- **image-gen**: Disable safety checker for all image generation models
- **release**: Add Claude release agent with comprehensive release notes
- **beat-navigation**: Add vertical scrolling improvements
- **beat-ai**: Add rewrite beat functionality
- **beat-ai**: Group related buttons to save horizontal space
- **beat-ai**: Add tooltip to truncated scene chips
- **beat-ai**: Truncate current scene context at beat position
- **beat-history**: Implement Phase 1 - beat version history foundation
- **beat-history**: Implement Phase 2 - version history UI components
- **beat-history**: Add database maintenance UI for beat version histories
- **beat-history**: Store original text and action type in version history
- **ai-rewrite**: Add explicit instructions to return only rewritten text
- **sync**: Implement selective sync for active story only
- **sync**: Phase 1 - Add Story Metadata Index service and data models
- **sync**: Phase 2 - Integrate metadata index with StoryService
- **sync**: Phase 3 - Update Story List to use Metadata Index
- **sync**: Phase 4 - Optimize sync filter for metadata index
- **sync**: Phase 5 - Add loading indicator for story sync
- **sync**: Add device tracking and sync history component
- **sync**: Add missing stories check on start page
- **sync**: Add detailed loading indicator during initial sync
- **sync**: Add granular document-level sync progress indicators
- **sync**: Auto-refresh story list and active story on sync completion
- **sync**: Improve remote database connection feedback on app startup
- **codex**: Add transfer button UI and help documentation
- **codex**: Add codex transfer modal component
- **editor**: Add swipe-accessible beat navigation panel for mobile
- **editor**: Add backward compatibility for beat ID attributes
- **stories**: Add automatic beat ID migration on story load
- **stories**: Ensure all beats have unique IDs during migration
- **stories**: Add media gallery for viewing all images and videos in a story
- **settings**: Add manual metadata index sync buttons
- **snapshots**: Implement server-side snapshot service with Docker
- **snapshots**: Implement Angular client with filtered replication and HTTP queries
- **snapshots**: Add version history UI with snapshot timeline modal
- **dev**: Update Angular CLI to 20.3.9 for MCP server support
- **debug**: Add visible debug panel for mobile story loading

## Bug Fixes

- **workflow**: Resolve YAML syntax error in sync-public.yml
- **stories**: Improve beat AI favorite labels
- **stories**: Exclude beat AI content from story preview text
- **beat-ai**: Resolve mobile dropdown issues with ng-select on iOS/Android
- **beat-ai**: Preserve original prompt when using rewrite feature
- **beat-ai**: Fix refreshCustomContext overwriting truncated scene content
- **beat-ai**: Comprehensive fix for scene truncation at beat position
- **beat-ai**: Use correct data-beat-id attribute in prompt-manager
- **beat-ai**: Fix broken regeneration for rewrite beats
- **beat-generation**: Correct POV auto-detection from 'first person' to 'third person limited'
- **beat-nav**: Fix scroll-to-beat failure after rewrite by correcting attribute name
- **beat-nav**: Replace distracting red badge with subtle white design
- **beat-nav**: Correct scroll-to-beat positioning
- **beat-nav**: Improve scroll-to-beat positioning accuracy
- **beat-nav**: Generate IDs for legacy beats without data-id attribute
- **beat-history**: Convert date strings to Date objects when loading history
- **beat-history**: Use theme-aware colors in version history modal
- **beat-history**: Trigger change detection when updating beat node
- **beat-history**: Add missing hasHistory and currentVersionId to node view
- **beat-history**: Preserve newlines and formatting when restoring beat history versions
- **editor**: Preserve scroll and cursor position in AI rewrite modal
- **story-editor**: Resolve stale state issue in saveStory causing data loss
- **story-editor**: Trigger save after beat generation completes
- **story-editor**: Eliminate double-save race condition in persistSceneBeforeBeatAction
- **outline-overview**: Fix event handling and improve performance
- **outline-overview**: Preserve accordion expanded state during save operations
- **outline-overview**: Comprehensive fix for accordion collapse issue
- **ui**: Fix header viewport overlap during beat editing and generation
- **ui**: Prevent header from scrolling out of view on mobile beat navigation
- **mobile**: Prevent header from scrolling out of view during beat navigation
- **sync**: Wait for initial sync before loading metadata index
- **sync**: Prevent empty metadata index from overwriting remote data
- **sync**: Set activeStoryId before loading to enable selective sync
- **sync**: Force immediate replication of story document when opening
- **sync**: Resolve story loading delay after cache clear and improve sync status
- **sync**: Exclude all system documents from story count
- **metadata**: Ensure metadata index updates when reordering stories
- **codex**: Fix transfer modal viewport on mobile
- **codex**: Fix missing footer buttons in transfer modal
- **codex**: Enforce strict height constraints for mobile modal
- **codex**: Reduce transfer modal height to 80vh for mobile visibility
- **codex**: Reduce transfer modal to 70vh for mobile viewport
- **codex**: Use fixed footer positioning for mobile modal visibility
- **codex**: Restore proper flexbox layout for transfer modal
- **codex**: Add safe-area padding for Android navigation bar
- **codex**: Use app-wide Android nav bar pattern (+48px)
- **settings**: Persist Ollama and Replicate model selections
- **replicate**: Add proxy configuration for CORS-free API access
- **replicate**: Use language-models collection endpoint to load LLM models
- **replicate**: Correct API endpoint and authentication for model loading
- **replicate**: Add /v1 to API path for correct proxy routing
- **replicate**: Correct API URL path to prevent duplicate /v1
- **nginx**: Correct proxy_pass to preserve full request path
- **image-generation**: Preserve prompt when switching models
- **image-gen**: Simplify model loading to prevent infinite loading
- **image-gen**: Remove 20 model limit, fetch all text-to-image models
- **database**: Correct story counting logic to properly identify story documents
- **database**: Remove setTimeout to prevent race condition on user login
- **database**: Add automatic cleanup of old IndexedDB databases to prevent mobile crashes
- **tests**: Fix TokenCounterService tests by adding HttpClient provider
- **snapshots**: Fix CouchDB view query encoding and missing icon
- **snapshot-service**: Properly update existing design documents
- **snapshots**: Reverse startkey/endkey for descending CouchDB query
- **browser-compat**: Improve Vivaldi browser compatibility and error handling
- **media-gallery**: Display all images from database instead of filtering by content references
- **media-gallery**: Show only images actually used in the current story

## Refactoring

- **beat-prompts**: Restructure instructions using CO-STAR framework (2025 best practices)
- **beat-prompts**: Apply CO-STAR framework to French and Spanish templates
- **beat-ai**: Consolidate rewrite prompt construction into template system
- **beat-nav**: Redesign edge indicator with subtle transparent styling
- **beat-nav**: Change icon from wand to git-commit
- **editor**: Extract restoreEditorState helper method
- **editor**: Replace magic number with named constant
- **editor**: Simplify state restoration to use only requestAnimationFrame
- **editor**: Remove unused DOM_UPDATE_DELAY_MS constant
- **editor**: Split ProseMirrorEditorService into logical sub-services
- **story-editor**: Integrate SceneNavigationService and StoryEditorStateService
- **sync**: Improve missing stories UI with toast and template optimization
- **ai**: Create centralized AI provider validation service

## Performance Improvements

- **stories**: Implement caching for story previews and word counts (Phase 1)
- **stories**: Implement indexed queries and pagination (Phase 2)
- **stories**: Implement schema versioning to skip unnecessary migrations
- **stories**: Add performance logging and fix blocking sync initialization
- **stories**: Revert to allDocs() and simplify indexes for dramatic performance improvement

## Tests

- **editor**: Add comprehensive unit tests for editor sub-services
- **beat-nav**: Add comprehensive tests for attribute name consistency
- Fix timing issues in service observable tests
- Fix failing test suite - add HttpClient providers and remove obsolete test

## Documentation

- **beat-history**: Reorganize documentation into dedicated folder
- **beat-history**: Add user guide and automatic cleanup on story deletion
- **beat-history**: Add comprehensive feature specification and implementation plan
- **editor**: Clarify independence of scroll and focus restoration
- **snapshots**: Add comprehensive design document for snapshot and rollback system
- **snapshots**: Add server-side snapshot service design with Docker architecture
- **snapshots**: Add tradeoffs analysis and server-only implementation guide
- **performance**: Add comprehensive performance optimization plan
- **performance**: Document Phase 2 rollback and lessons learned
- **performance**: Document Phase 4 - performance logging and sync fix
- Mark all phases complete with comprehensive Phase 5 documentation
- Add comprehensive implementation progress tracking document

## Maintenance

- Rename release command to /release_creativewriter
- Remove proxy/node_modules from git and update .gitignore
- Remove debug console logs from services and components
- Create sample-beat-prompt.txt
- Remove snapshot service tradeoffs and story loading performance analysis documents

## Other

- Add logging for multiple image outputs (debug)
- Add diagnostic logging for story sync troubleshooting (debug)
- Revert several changes (sync, UI fixes)
- Update CLAUDE.md

---
*Release prepared by Claude Code*
