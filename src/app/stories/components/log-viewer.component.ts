import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';
import { AILogTabComponent } from './ai-log-tab/ai-log-tab.component';
import { SyncLogTabComponent } from './sync-log-tab.component';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonSegment, IonSegmentButton, IonLabel,
    AILogTabComponent,
    SyncLogTabComponent
  ],
  template: `
    <div class="ion-page">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button (click)="goBack()">
              <ion-icon name="arrow-back" slot="icon-only"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title>System Logs</ion-title>
        </ion-toolbar>
        
        <ion-toolbar>
          <ion-segment [(ngModel)]="selectedTab" color="primary">
            <ion-segment-button value="ai">
              <ion-label>AI Requests</ion-label>
            </ion-segment-button>
            <ion-segment-button value="sync">
              <ion-label>Synchronisation</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <app-ai-log-tab *ngIf="selectedTab === 'ai'"></app-ai-log-tab>
        <app-sync-log-tab *ngIf="selectedTab === 'sync'"></app-sync-log-tab>
      </ion-content>
    </div>
  `,
  styles: [`
    .ion-page {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--ion-background-color);
    }

    ion-content {
      --background: var(--ion-background-color);
      flex: 1;
    }
    
    ion-segment {
      margin: 0.5rem 1rem;
    }
  `]
})
export class LogViewerComponent {
  selectedTab = 'ai';

  private readonly router = inject(Router);

  constructor() {
    addIcons({ arrowBack });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}