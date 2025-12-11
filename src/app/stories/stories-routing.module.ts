import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StoryEditorComponent } from './components/story-editor/story-editor.component';
import { StoryEditorExitGuard } from './guards/story-editor-exit.guard';
import { StorySettingsComponent } from './components/story-settings/story-settings.component';
import { CodexComponent } from './components/codex/codex.component';
import { NovelCrafterImportComponent } from './components/novelcrafter-import/novelcrafter-import.component';
import { ImageGenerationComponent } from './components/image-generation/image-generation.component';
import { SceneChatComponent } from './components/scene-chat/scene-chat.component';
import { CharacterChatComponent } from './components/character-chat/character-chat.component';
import { StoryResearchComponent } from './components/story-research/story-research.component';
import { StoryOutlineOverviewComponent } from './components/story-outline-overview/story-outline-overview.component';
import { SyncHistoryComponent } from './components/sync-history/sync-history.component';

const routes: Routes = [
  {
    path: 'editor/:id',
    component: StoryEditorComponent,
    canDeactivate: [StoryEditorExitGuard]
  },
  {
    path: 'settings/:id',
    component: StorySettingsComponent
  },
  {
    path: 'codex/:id',
    component: CodexComponent
  },
  {
    path: 'import/novelcrafter',
    component: NovelCrafterImportComponent
  },
  {
    path: 'image-generation',
    component: ImageGenerationComponent
  },
  {
    path: 'chat/:storyId/:chapterId/:sceneId',
    component: SceneChatComponent
  },
  {
    path: 'character-chat/:storyId',
    component: CharacterChatComponent
  },
  {
    path: 'character-chat/:storyId/:characterId',
    component: CharacterChatComponent
  },
  {
    path: 'research/:id',
    component: StoryResearchComponent
  },
  {
    path: 'outline/:id',
    component: StoryOutlineOverviewComponent
  },
  {
    path: 'sync-history',
    component: SyncHistoryComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StoriesRoutingModule { }
