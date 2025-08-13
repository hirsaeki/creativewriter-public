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
import { AILogTabComponent } from '../ai-log-tab/ai-log-tab.component';
import { SyncLogTabComponent } from '../sync-log-tab/sync-log-tab.component';

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
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
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