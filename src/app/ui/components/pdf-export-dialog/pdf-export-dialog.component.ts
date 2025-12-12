import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonItem, IonLabel, IonList, IonCheckbox, IonSelect, IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';

export interface PDFExportDialogOptions {
  includeBackground: boolean;
  format: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
}

@Component({
  selector: 'app-pdf-export-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonItem, IonLabel, IonList, IonCheckbox, IonSelect, IonSelectOption
  ],
  templateUrl: './pdf-export-dialog.component.html',
  styleUrls: ['./pdf-export-dialog.component.scss']
})
export class PDFExportDialogComponent {
  private modalCtrl = inject(ModalController);

  includeBackground = false;
  format: 'a4' | 'letter' = 'a4';
  orientation: 'portrait' | 'landscape' = 'portrait';

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    const options: PDFExportDialogOptions = {
      includeBackground: this.includeBackground,
      format: this.format,
      orientation: this.orientation
    };
    this.modalCtrl.dismiss(options, 'confirm');
  }
}
