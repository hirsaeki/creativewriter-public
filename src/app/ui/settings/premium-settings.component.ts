import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonIcon,
  IonSpinner, IonBadge, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, checkmarkCircle, closeCircle, refresh, link } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-premium-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonButton, IonIcon,
    IonSpinner, IonBadge, IonNote
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="star" class="premium-icon"></ion-icon>
          Premium Subscription
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- Status Badge -->
        <div class="status-section">
          <ion-badge [color]="isPremium ? 'success' : 'medium'">
            <ion-icon [name]="isPremium ? 'checkmark-circle' : 'close-circle'"></ion-icon>
            {{ isPremium ? 'Active' : 'Not Active' }}
          </ion-badge>
          <span *ngIf="isPremium && plan" class="plan-badge">{{ plan | titlecase }} Plan</span>
          <span *ngIf="isPremium && expiresAt" class="expires-text">
            Expires: {{ expiresAt | date:'mediumDate' }}
          </span>
        </div>

        <!-- Email Input -->
        <ion-item>
          <ion-label position="stacked">Subscription Email</ion-label>
          <ion-input
            type="email"
            [(ngModel)]="email"
            placeholder="Enter the email used for subscription"
            (ionBlur)="onEmailBlur()">
          </ion-input>
        </ion-item>
        <ion-note class="input-note">
          Enter the email address you used to purchase your subscription.
        </ion-note>

        <!-- API URL (Advanced) -->
        <div class="advanced-section">
          <ion-item>
            <ion-label position="stacked">API URL (Advanced)</ion-label>
            <ion-input
              type="url"
              [(ngModel)]="apiUrl"
              placeholder="https://creativewriter-api.nostramo.workers.dev/api"
              (ionBlur)="onApiUrlBlur()">
            </ion-input>
          </ion-item>
          <ion-note class="input-note">
            Only change this if you're using a custom subscription server.
          </ion-note>
        </div>

        <!-- Actions -->
        <div class="actions">
          <ion-button
            expand="block"
            (click)="verifySubscription()"
            [disabled]="isVerifying || !email">
            <ion-spinner *ngIf="isVerifying" name="crescent" slot="start"></ion-spinner>
            <ion-icon *ngIf="!isVerifying" name="refresh" slot="start"></ion-icon>
            {{ isVerifying ? 'Verifying...' : 'Verify Subscription' }}
          </ion-button>

          <ion-button
            expand="block"
            fill="outline"
            color="primary"
            href="https://creativewriter.app/premium"
            target="_blank">
            <ion-icon name="link" slot="start"></ion-icon>
            Get Premium
          </ion-button>
        </div>

        <!-- Error/Success Message -->
        <div *ngIf="message" class="message" [class.success]="messageType === 'success'" [class.error]="messageType === 'error'">
          {{ message }}
        </div>

        <!-- Premium Features Info -->
        <div class="features-info">
          <h4>Premium Features</h4>
          <ul>
            <li><strong>Character Chat</strong> - Interview your characters and explore their personalities</li>
            <li><em>More features coming soon...</em></li>
          </ul>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .premium-icon {
      color: #ffc107;
      margin-right: 0.5rem;
    }

    .status-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    ion-badge {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.9rem;
    }

    .plan-badge {
      background: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .expires-text {
      color: #9ca3af;
      font-size: 0.85rem;
    }

    ion-item {
      --background: rgba(20, 20, 20, 0.3);
      --border-color: rgba(139, 180, 248, 0.2);
      margin-bottom: 0.25rem;
      border-radius: 8px;
    }

    .input-note {
      display: block;
      font-size: 0.8rem;
      color: #6b7280;
      padding: 0.25rem 1rem 1rem;
    }

    .advanced-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(139, 180, 248, 0.1);
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .message {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .message.success {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
    }

    .message.error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }

    .features-info {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(139, 180, 248, 0.1);
    }

    .features-info h4 {
      color: #f8f9fa;
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
    }

    .features-info ul {
      margin: 0;
      padding-left: 1.25rem;
      color: #9ca3af;
    }

    .features-info li {
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }

    .features-info strong {
      color: #e0e0e0;
    }
  `]
})
export class PremiumSettingsComponent implements OnInit, OnDestroy {
  private subscriptionService = inject(SubscriptionService);
  private settingsService = inject(SettingsService);

  email = '';
  apiUrl = '';
  isPremium = false;
  isVerifying = false;
  plan?: 'monthly' | 'yearly';
  expiresAt?: Date;
  message = '';
  messageType: 'success' | 'error' | '' = '';

  private subscriptions = new Subscription();

  constructor() {
    addIcons({ star, checkmarkCircle, closeCircle, refresh, link });
  }

  ngOnInit(): void {
    // Load current settings
    const settings = this.settingsService.getSettings();
    this.email = settings.premium?.email || '';
    this.apiUrl = settings.premium?.apiUrl || 'https://creativewriter-api.nostramo.workers.dev/api';

    // Subscribe to premium status
    this.subscriptions.add(
      this.subscriptionService.isPremiumObservable.subscribe(isPremium => {
        this.isPremium = isPremium;
        this.updateStatusFromCache();
      })
    );

    this.subscriptions.add(
      this.subscriptionService.isVerifying.subscribe(isVerifying => {
        this.isVerifying = isVerifying;
      })
    );

    // Initialize status
    this.subscriptionService.initialize();
    this.updateStatusFromCache();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private updateStatusFromCache(): void {
    const settings = this.settingsService.getSettings();
    const cached = settings.premium?.cachedStatus;
    if (cached) {
      this.plan = cached.plan;
      this.expiresAt = cached.expiresAt ? new Date(cached.expiresAt) : undefined;
    }
  }

  onEmailBlur(): void {
    const settings = this.settingsService.getSettings();
    if (this.email !== settings.premium?.email) {
      this.settingsService.updateSettings({
        premium: {
          ...settings.premium,
          email: this.email.trim().toLowerCase()
        }
      });
    }
  }

  onApiUrlBlur(): void {
    const settings = this.settingsService.getSettings();
    if (this.apiUrl !== settings.premium?.apiUrl) {
      this.subscriptionService.setApiUrl(this.apiUrl);
    }
  }

  async verifySubscription(): Promise<void> {
    this.message = '';
    this.messageType = '';

    if (!this.email) {
      this.message = 'Please enter your subscription email';
      this.messageType = 'error';
      return;
    }

    try {
      const isActive = await this.subscriptionService.setEmail(this.email);
      this.updateStatusFromCache();

      if (isActive) {
        this.message = 'Subscription verified successfully!';
        this.messageType = 'success';
      } else {
        this.message = 'No active subscription found for this email';
        this.messageType = 'error';
      }
    } catch {
      this.message = 'Failed to verify subscription. Please check your connection.';
      this.messageType = 'error';
    }
  }
}
