import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonReorderGroup,
  IonReorder,
  IonButton,
  IonIcon,
  IonNote,
  IonSpinner
} from '@ionic/angular/standalone';
import { ItemReorderEventDetail } from '@ionic/angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { Settings } from '../../../core/models/settings.interface';
import { ModelOption } from '../../../core/models/model.interface';
import { addIcons } from 'ionicons';
import { closeOutline, logoGoogle, globeOutline, sparklesOutline } from 'ionicons/icons';
import { OpenRouterIconComponent } from '../../icons/openrouter-icon.component';
import { ClaudeIconComponent } from '../../icons/claude-icon.component';
import { ReplicateIconComponent } from '../../icons/replicate-icon.component';
import { OllamaIconComponent } from '../../icons/ollama-icon.component';

@Component({
  selector: 'app-model-favorites-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonReorderGroup,
    IonReorder,
    IonButton,
    IonIcon,
    IonNote,
    IonSpinner,
    OpenRouterIconComponent,
    ClaudeIconComponent,
    ReplicateIconComponent,
    OllamaIconComponent
  ],
  templateUrl: './model-favorites-settings.component.html',
  styleUrls: ['./model-favorites-settings.component.css']
})
export class ModelFavoritesSettingsComponent implements OnChanges {
  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelLoadError: string | null = null;
  @Output() settingsChange = new EventEmitter<void>();

  readonly maxFavorites = 6;
  selectedFavorites: string[] = [];

  constructor() {
    addIcons({ closeOutline, logoGoogle, globeOutline, sparklesOutline });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['settings']) {
      this.syncFromSettings();
    }

    if (changes['combinedModels'] && !changes['combinedModels'].firstChange) {
      this.pruneUnknownFavorites();
    }
  }

  get favoriteModelOptions(): ModelOption[] {
    return this.selectedFavorites
      .map(id => this.combinedModels.find(model => model.id === id))
      .filter((model): model is ModelOption => !!model);
  }

  onFavoritesChange(favoriteIds: string[]): void {
    const limited = favoriteIds.slice(0, this.maxFavorites);
    this.selectedFavorites = [...limited];
    this.persistFavorites();
  }

  onReorder(event: CustomEvent<ItemReorderEventDetail>): void {
    const { from, to } = event.detail;
    this.selectedFavorites = this.reorderArray(this.selectedFavorites, from, to);
    event.detail.complete();
    this.persistFavorites();
  }

  removeFavorite(id: string): void {
    this.selectedFavorites = this.selectedFavorites.filter(fav => fav !== id);
    this.persistFavorites();
  }

  trackById(_index: number, option: ModelOption): string {
    return option.id;
  }

  isGenericProvider(provider: string): boolean {
    return !['openrouter', 'claude', 'replicate', 'ollama'].includes(provider);
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'logo-google';
      case 'grok':
        return 'sparkles-outline';
      default:
        return 'globe-outline';
    }
  }

  private syncFromSettings(): void {
    if (!this.settings) {
      this.selectedFavorites = [];
      return;
    }

    const beatFavorites = this.settings.favoriteModelLists?.beatInput ?? this.settings.favoriteModels ?? [];
    this.selectedFavorites = [...beatFavorites].slice(0, this.maxFavorites);
    this.pruneUnknownFavorites();
  }

  private pruneUnknownFavorites(): void {
    if (!this.combinedModels?.length) {
      return;
    }

    const knownIds = new Set(this.combinedModels.map(model => model.id));
    const filtered = this.selectedFavorites.filter(id => knownIds.has(id));
    if (filtered.length !== this.selectedFavorites.length) {
      this.selectedFavorites = filtered;
      this.persistFavorites();
    }
  }

  private persistFavorites(): void {
    if (!this.settings) {
      return;
    }

    const nextFavorites = this.selectedFavorites.slice(0, this.maxFavorites);

    if (!this.settings.favoriteModelLists) {
      this.settings.favoriteModelLists = { beatInput: [] };
    }

    this.settings.favoriteModelLists = {
      ...this.settings.favoriteModelLists,
      beatInput: [...nextFavorites]
    };
    this.settings.favoriteModels = [...nextFavorites];
    this.settingsChange.emit();
  }

  private reorderArray(list: string[], from: number, to: number): string[] {
    const updated = [...list];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    return updated;
  }
}
