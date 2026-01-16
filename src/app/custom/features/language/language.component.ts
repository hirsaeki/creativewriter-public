import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonIcon,
  IonList,
  IonRadioGroup,
  IonRadio,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { languageOutline, checkmarkCircle } from 'ionicons/icons';
import { RadioGroupCustomEvent } from '@ionic/angular';
import { I18nService, I18nPipe, Language } from '../../i18n';

@Component({
  selector: 'app-language',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonIcon,
    IonList,
    IonRadioGroup,
    IonRadio,
    I18nPipe,
  ],
  templateUrl: './language.component.html',
  styleUrls: ['./language.component.scss'],
})
export class LanguageComponent {
  private readonly i18n = inject(I18nService);

  readonly currentLang = this.i18n.lang;
  readonly languages: { code: Language; labelKey: 'settings.language.ja' | 'settings.language.en' }[] = [
    { code: 'ja', labelKey: 'settings.language.ja' },
    { code: 'en', labelKey: 'settings.language.en' },
  ];

  constructor() {
    addIcons({ languageOutline, checkmarkCircle });
  }

  onLanguageChange(event: RadioGroupCustomEvent<Language>): void {
    const lang = event.detail.value;
    if (lang === 'ja' || lang === 'en') {
      this.i18n.setLang(lang);
    }
  }
}
