/**
 * Character Chat Component - Public Stub Version
 *
 * This is a minimal stub that shows "Premium Feature" message.
 * The full implementation is only available in the private repository.
 *
 * During public sync, this file replaces character-chat.component.ts
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import {
  IonContent, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, lockClosed, sparkles } from 'ionicons/icons';
import { AppHeaderComponent } from '../../../ui/components/app-header.component';

@Component({
  selector: 'app-character-chat',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    IonContent, IonButton, IonIcon,
    AppHeaderComponent
  ],
  template: `
    <div class="ion-page">
      <app-header
        [title]="'Character Chat'"
        [showBackButton]="true"
        [backAction]="goBack.bind(this)">
      </app-header>

      <ion-content class="ion-padding">
        <div class="premium-container">
          <div class="premium-icon">
            <ion-icon name="sparkles"></ion-icon>
          </div>
          <h1>Premium Feature</h1>
          <p>
            Character Chat allows you to have immersive conversations with
            characters from your story. Interview your protagonists, explore
            their motivations, and discover new story possibilities.
          </p>
          <div class="features">
            <div class="feature">
              <ion-icon name="chatbubbles-outline"></ion-icon>
              <span>In-character conversations</span>
            </div>
            <div class="feature">
              <ion-icon name="time-outline"></ion-icon>
              <span>Knowledge cutoff control</span>
            </div>
            <div class="feature">
              <ion-icon name="people-outline"></ion-icon>
              <span>All your codex characters</span>
            </div>
          </div>
          <ion-button expand="block" routerLink="/settings" [queryParams]="{tab: 'premium'}">
            <ion-icon name="lock-closed" slot="start"></ion-icon>
            Unlock Premium
          </ion-button>
        </div>
      </ion-content>
    </div>
  `,
  styles: [`
    .premium-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      max-width: 500px;
      margin: 0 auto;
      height: 100%;
    }

    .premium-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;

      ion-icon {
        font-size: 2.5rem;
        color: white;
      }
    }

    h1 {
      color: #f8f9fa;
      margin: 0 0 1rem;
      font-size: 1.75rem;
    }

    p {
      color: #9ca3af;
      line-height: 1.6;
      margin-bottom: 2rem;
    }

    .features {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
      width: 100%;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(102, 126, 234, 0.1);
      border-radius: 8px;
      color: #e0e0e0;

      ion-icon {
        color: #667eea;
        font-size: 1.25rem;
      }
    }

    ion-button {
      --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin-top: 1rem;
    }
  `]
})
export class CharacterChatComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    addIcons({ arrowBack, lockClosed, sparkles });
  }

  goBack(): void {
    const storyId = this.route.snapshot.paramMap.get('storyId');
    if (storyId) {
      this.router.navigate(['/stories/editor', storyId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}
