# Large Files Analysis - Code Splitting Opportunities

## Analysis Summary

**Largest Files by Lines of Code:**
1. **prosemirror-editor.service.ts** - 1,762 lines, 205+ methods
2. **story-editor.component.ts** - 1,566 lines, 225+ methods  
3. **beat-ai.component.ts** - 1,077 lines, 145+ methods
4. **scene-chat.component.ts** - 1,021 lines, 100+ methods
5. **beat-ai.service.ts** - 981 lines, 100+ methods

## Files That Can Be Easily Split:

### 1. **prosemirror-editor.service.ts** (1,762 lines)
**High Priority - Most Complex**
- Contains both main editor and simple text editor functionality
- Has image handling, beat AI integration, and codex highlighting
- **Potential splits:**
  - `prosemirror-schema.service.ts` - Schema definitions and node configurations
  - `prosemirror-plugins.service.ts` - Plugin management (codex highlighting, etc.)
  - `prosemirror-simple-editor.service.ts` - Simple text editor functionality
  - `prosemirror-beat-integration.service.ts` - Beat AI node view and integration

### 2. **story-editor.component.ts** (1,566 lines)
**High Priority - UI Component**
- Massive component handling multiple responsibilities
- **Potential splits:**
  - `story-editor-content.component.ts` - Content editing functionality
  - `story-editor-navigation.component.ts` - Scene/chapter navigation
  - `story-editor-toolbar.component.ts` - Toolbar and commands
  - `story-editor-autosave.service.ts` - Auto-save logic as separate service

### 3. **beat-ai.component.ts** (1,077 lines)
**Medium Priority**
- Complex AI interaction component
- **Potential splits:**
  - `beat-ai-chat.component.ts` - Chat interface
  - `beat-ai-prompts.component.ts` - Prompt management
  - `beat-ai-streaming.service.ts` - Streaming response handling

### 4. **beat-ai.service.ts** (981 lines)
**Medium Priority**
- Service with multiple AI provider integrations
- **Potential splits:**
  - `beat-ai-providers.service.ts` - Different AI provider implementations
  - `beat-ai-streaming.service.ts` - Streaming logic
  - `beat-ai-prompt-processing.service.ts` - Prompt processing logic

## Conclusion

These files are excellent candidates for splitting because they have clear functional boundaries and multiple responsibilities that can be separated into focused, single-purpose modules. The splits would improve:
- Code maintainability
- Testing isolation
- Development team collaboration
- Bundle size optimization potential