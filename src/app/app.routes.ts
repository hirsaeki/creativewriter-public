import { Routes } from '@angular/router';
import { StoryListComponent } from './stories/components/story-list/story-list.component';
import { LogViewerComponent } from './stories/components/log-viewer/log-viewer.component';

export const routes: Routes = [
  {
    path: '',
    component: StoryListComponent
  },
  {
    path: 'stories',
    loadChildren: () => import('./stories/stories.module').then(m => m.StoriesModule)
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'logs',
    component: LogViewerComponent
  },
  {
    path: 'ai-logs',
    redirectTo: 'logs'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
