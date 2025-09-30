import { Injectable, inject } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { StoryEditorComponent } from '../components/story-editor/story-editor.component';
import { StoryService } from '../services/story.service';

@Injectable({ providedIn: 'root' })
export class StoryEditorExitGuard implements CanDeactivate<StoryEditorComponent> {
  private readonly storyService = inject(StoryService);

  async canDeactivate(component: StoryEditorComponent): Promise<boolean> {
    try {
      // Offer deletion for empty, untitled default drafts on any route change
      if (typeof component.isDefaultEmptyDraft === 'function' && component.isDefaultEmptyDraft()) {
        const shouldDelete = confirm('This draft has no title or content. Delete it?');
        if (shouldDelete) {
          try {
            await this.storyService.deleteStory(component.story.id);
          } catch (err) {
            console.error('Failed to delete empty draft via guard:', err);
          }
          // After deletion, continue navigation without further prompts
          return true;
        }
        // If user cancels deletion, fall through to unsaved-changes handling below
      }

      // Unsaved changes confirmation (outside of empty-draft deletion)
      if (component.hasUnsavedChanges) {
        const save = confirm('You have unsaved changes. Save before leaving?');
        if (save) {
          try {
            await component.saveStory();
            return true;
          } catch (err) {
            console.error('Failed to save changes in guard:', err);
            const discard = confirm('Save failed. Discard changes and leave?');
            return discard;
          }
        } else {
          const discard = confirm('Discard changes and leave?');
          return discard;
        }
      }
    } catch (err) {
      // Non-blocking guard: always allow navigation
      console.warn('StoryEditorExitGuard encountered an issue:', err);
    }

    return true;
  }
}
