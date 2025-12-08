import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, closeOutline, rocketOutline } from 'ionicons/icons';

@Component({
  selector: 'app-premium-upsell-dialog',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon
  ],
  templateUrl: './premium-upsell-dialog.component.html',
  styleUrls: ['./premium-upsell-dialog.component.scss']
})
export class PremiumUpsellDialogComponent {
  @Input() featureName = 'This Feature';
  @Input() description = 'Upgrade to Premium to unlock this feature.';
  @Input() benefits: string[] = [];

  private modalController = inject(ModalController);
  private router = inject(Router);

  constructor() {
    addIcons({ star, closeOutline, rocketOutline });
  }

  dismiss(): void {
    this.modalController.dismiss();
  }

  goToSettings(): void {
    this.modalController.dismiss();
    this.router.navigate(['/settings'], { queryParams: { tab: 'premium' } });
  }
}
