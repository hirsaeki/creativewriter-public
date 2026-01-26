import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonItem, IonLabel, IonRadioGroup, IonRadio, IonList,
  ModalController
} from '@ionic/angular/standalone';

export type StoryLanguage = 'en' | 'de' | 'fr' | 'es' | 'ja' | 'custom';

@Component({
  selector: 'app-language-selection-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonItem, IonLabel, IonRadioGroup, IonRadio, IonList
  ],
  templateUrl: './language-selection-dialog.component.html',
  styleUrls: ['./language-selection-dialog.component.scss']
})
export class LanguageSelectionDialogComponent {
  private modalCtrl = inject(ModalController);
  
  selectedLanguage: StoryLanguage = 'en';

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss(this.selectedLanguage, 'confirm');
  }
}
