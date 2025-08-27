import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonItem, IonRadioGroup, IonRadio,
  ModalController
} from '@ionic/angular/standalone';

export type StoryLanguage = 'en' | 'de' | 'fr' | 'es' | 'custom';

@Component({
  selector: 'app-language-selection-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonItem, IonRadioGroup, IonRadio
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Story Language</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" (click)="dismiss()">
            Cancel
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="dialog-content">
        <p class="description">
          Choose the language for your story. This will set the AI assistant's language for generating content.
        </p>
        
        <div class="language-selection-container">
          <ion-radio-group [(ngModel)]="selectedLanguage" class="language-radio-group">
            <div class="language-option" [class.selected]="selectedLanguage === 'en'">
              <ion-item button (click)="selectLanguage('en')">
                <div class="language-info">
                  <h2>English</h2>
                  <p>AI will assist in English</p>
                </div>
                <ion-radio slot="end" value="en"></ion-radio>
              </ion-item>
            </div>
            
            <div class="language-option" [class.selected]="selectedLanguage === 'de'">
              <ion-item button (click)="selectLanguage('de')">
                <div class="language-info">
                  <h2>Deutsch</h2>
                  <p>KI-Assistent auf Deutsch</p>
                </div>
                <ion-radio slot="end" value="de"></ion-radio>
              </ion-item>
            </div>
            
            <div class="language-option" [class.selected]="selectedLanguage === 'fr'">
              <ion-item button (click)="selectLanguage('fr')">
                <div class="language-info">
                  <h2>Français</h2>
                  <p>Assistant IA en français</p>
                </div>
                <ion-radio slot="end" value="fr"></ion-radio>
              </ion-item>
            </div>
            
            <div class="language-option" [class.selected]="selectedLanguage === 'es'">
              <ion-item button (click)="selectLanguage('es')">
                <div class="language-info">
                  <h2>Español</h2>
                  <p>Asistente de IA en español</p>
                </div>
                <ion-radio slot="end" value="es"></ion-radio>
              </ion-item>
            </div>
            
            <div class="language-option" [class.selected]="selectedLanguage === 'custom'">
              <ion-item button (click)="selectLanguage('custom')">
                <div class="language-info">
                  <h2>Custom Language</h2>
                  <p>Use default English, customize later in settings</p>
                </div>
                <ion-radio slot="end" value="custom"></ion-radio>
              </ion-item>
            </div>
          </ion-radio-group>
        </div>
        
        <div class="button-container">
          <ion-button 
            expand="block" 
            size="large"
            (click)="confirm()" 
            [disabled]="!selectedLanguage"
            class="create-button">
            Create Story
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    ion-header {
      backdrop-filter: blur(15px);
      background: rgba(45, 45, 45, 0.9);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
      position: relative;
      z-index: 100;
    }

    ion-toolbar {
      --background: transparent;
      --color: #f8f9fa;
      --border-width: 0;
    }

    ion-title {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    ion-content {
      --background: rgba(25, 25, 25, 0.95) !important;
      backdrop-filter: blur(10px);
    }

    ion-content::part(background) {
      background: rgba(25, 25, 25, 0.95) !important;
    }

    .dialog-content {
      max-width: 500px;
      margin: 0 auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 400px;
    }

    .description {
      text-align: center;
      margin: 0.5rem 0 1rem 0;
      color: #f8f9fa;
      font-size: 0.95rem;
      line-height: 1.4;
      opacity: 0.9;
    }

    .language-selection-container {
      background: linear-gradient(135deg, rgba(30, 30, 30, 0.5) 0%, rgba(25, 25, 25, 0.5) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .language-radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .language-option {
      background: rgba(30, 30, 30, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(5px);
      transition: all 0.3s ease;
      overflow: hidden;
      position: relative;
    }

    .language-option:hover {
      background: rgba(40, 40, 40, 0.4);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      transform: translateY(-1px);
    }

    .language-option.selected {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      border-color: rgba(71, 118, 230, 0.5);
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.3);
    }

    .language-option.selected::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(139, 180, 248, 0.1), transparent);
      transition: left 0.6s ease;
    }

    .language-option.selected:hover::before {
      left: 100%;
    }

    .language-option ion-item {
      --background: transparent;
      --color: #f8f9fa;
      --padding-start: 1rem;
      --padding-end: 1rem;
      --inner-padding-end: 0;
      --inner-padding-start: 0;
      --border-style: none;
      cursor: pointer;
    }

    .language-info {
      flex: 1;
      padding: 0.5rem 0;
    }

    .language-info h2 {
      color: #f8f9fa;
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0 0 0.25rem 0;
      letter-spacing: 0.3px;
    }

    .language-info p {
      color: #adb5bd;
      font-size: 0.9rem;
      margin: 0;
      opacity: 0.8;
      line-height: 1.4;
    }

    .language-option.selected .language-info h2 {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .language-option.selected .language-info p {
      color: #8bb4f8;
      opacity: 1;
    }

    ion-radio {
      --color: #4776e6;
      --color-checked: #8bb4f8;
      --border-width: 2px;
      --border-style: solid;
      --border-color: rgba(255, 255, 255, 0.3);
    }

    .language-option.selected ion-radio {
      --border-color: #8bb4f8;
    }

    .button-container {
      text-align: center;
      margin-top: auto;
      padding-top: 1rem;
    }

    .create-button {
      --background: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      --color: #ffffff;
      --border-radius: 12px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      --box-shadow: 0 4px 16px rgba(71, 118, 230, 0.3);
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: none;
      transition: all 0.3s ease;
    }

    .create-button:hover:not([disabled]) {
      --box-shadow: 0 6px 20px rgba(71, 118, 230, 0.4);
      transform: translateY(-2px);
    }

    .create-button[disabled] {
      --background: rgba(108, 117, 125, 0.3);
      --color: rgba(255, 255, 255, 0.5);
      --box-shadow: none;
    }

    @media (max-width: 768px) {
      .dialog-content {
        padding: 0.5rem;
      }
      
      .language-info h2 {
        font-size: 1.1rem;
      }
      
      .language-info p {
        font-size: 0.85rem;
      }
    }

    @media (prefers-color-scheme: dark) {
      .language-option {
        background: rgba(30, 30, 30, 0.4);
        border-color: rgba(255, 255, 255, 0.15);
      }

      .language-option:hover {
        background: rgba(40, 40, 40, 0.5);
      }

      .language-option.selected {
        background: linear-gradient(135deg, rgba(71, 118, 230, 0.25) 0%, rgba(139, 180, 248, 0.25) 100%);
      }
    }
  `]
})
export class LanguageSelectionDialogComponent {
  private modalCtrl = inject(ModalController);
  
  selectedLanguage: StoryLanguage = 'en';

  selectLanguage(language: StoryLanguage) {
    this.selectedLanguage = language;
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss(this.selectedLanguage, 'confirm');
  }
}