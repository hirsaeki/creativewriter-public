import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BurgerMenuItem } from '../../ui/components/app-header.component';

@Injectable({
  providedIn: 'root'
})
export class HeaderNavigationService {
  private readonly router = inject(Router);

  // Common navigation actions
  goToStoryList(): void {
    this.router.navigate(['/']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToAILogger(): void {
    this.router.navigate(['/ai-logs']);
  }

  goToImageGeneration(): void {
    this.router.navigate(['/stories/image-generation']);
  }

  goToStoryInspector(storyId: string): void {
    this.router.navigate(['/stories/inspector', storyId]);
  }

  goToNovelCrafterImport(): void {
    this.router.navigate(['/stories/import/novelcrafter']);
  }

  goToCodex(storyId?: string): void {
    if (storyId) {
      this.router.navigate(['/stories/codex', storyId]);
    } else {
      // Fallback: go to story list if no story ID provided
      this.router.navigate(['/']);
    }
  }

  goToSceneChat(storyId?: string, chapterId?: string, sceneId?: string): void {
    if (storyId && chapterId && sceneId) {
      this.router.navigate(['/stories/chat', storyId, chapterId, sceneId]);
    } else {
      // Fallback: go to story list if parameters missing
      this.router.navigate(['/']);
    }
  }

  // Get common burger menu items
  getCommonBurgerMenuItems(): BurgerMenuItem[] {
    return [
      {
        icon: 'stats-chart',
        label: 'AI Logs',
        action: () => this.goToAILogger()
      },
      {
        icon: 'settings',
        label: 'Settings',
        action: () => this.goToSettings()
      },
      {
        icon: 'images',
        label: 'Image Generation',
        action: () => this.goToImageGeneration()
      },
      {
        icon: 'download',
        label: 'NovelCrafter Import',
        action: () => this.goToNovelCrafterImport()
      }
    ];
  }

  // Get story-specific burger menu items
  getStoryBurgerMenuItems(): BurgerMenuItem[] {
    const commonItems = this.getCommonBurgerMenuItems();
    return [
      ...commonItems
      // Additional story-specific items can be added here
    ];
  }

  // Get editor-specific burger menu items
  getEditorBurgerMenuItems(debugModeToggle?: () => void): BurgerMenuItem[] {
    const items: BurgerMenuItem[] = [];
    
    if (debugModeToggle) {
      items.push({
        icon: 'bug-outline',
        label: 'Debug Modus',
        action: debugModeToggle,
        color: 'warning'
      });
    }

    // Note: Codex and Scene Chat should be implemented by individual components
    // since they require story-specific context and parameters

    return [
      ...items,
      ...this.getCommonBurgerMenuItems()
    ];
  }
}
