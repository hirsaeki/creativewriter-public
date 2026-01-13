import { Component, OnInit, OnDestroy, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonToggle, IonButton, IonIcon, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, serverOutline, keyOutline, refreshOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ProxySettingsService } from '../../services/proxy-settings.service';
import { ProxySettings, ReverseProxyConfig } from '../../models/proxy-settings.interface';

@Component({
  selector: 'app-proxy-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonToggle, IonButton, IonIcon, IonNote
  ],
  templateUrl: './proxy-settings.component.html',
  styleUrls: ['./proxy-settings.component.scss']
})
export class ProxySettingsComponent implements OnInit, OnDestroy {
  private proxySettingsService = inject(ProxySettingsService);
  private subscription = new Subscription();

  @Output() settingsChange = new EventEmitter<void>();

  settings: ProxySettings = {
    claude: { enabled: false, url: '' },
    openRouter: { enabled: false, url: '' },
    googleGemini: { enabled: false, url: '' },
    ollama: {},
    openAICompatible: {}
  };

  constructor() {
    addIcons({ shieldCheckmarkOutline, serverOutline, keyOutline, refreshOutline });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.proxySettingsService.getSettings$().subscribe(settings => {
        this.settings = JSON.parse(JSON.stringify(settings));
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSettingsChange(): void {
    this.proxySettingsService.updateSettings(this.settings);
    this.settingsChange.emit();
  }

  onToggleChange(provider: 'claude' | 'openRouter' | 'googleGemini'): void {
    if (!this.settings[provider]) {
      this.settings[provider] = { enabled: false, url: '' };
    }
    this.onSettingsChange();
  }

  resetSettings(): void {
    this.proxySettingsService.resetSettings();
  }

  getProxyConfig(provider: 'claude' | 'openRouter' | 'googleGemini'): ReverseProxyConfig {
    if (!this.settings[provider]) {
      this.settings[provider] = { enabled: false, url: '' };
    }
    return this.settings[provider]!;
  }
}
