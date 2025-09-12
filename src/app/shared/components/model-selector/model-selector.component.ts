import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModelService } from '../../../core/services/model.service';
import { ModelOption } from '../../../core/models/model.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { OpenRouterIconComponent } from '../../../ui/icons/openrouter-icon.component';
import { ClaudeIconComponent } from '../../../ui/icons/claude-icon.component';
import { ReplicateIconComponent } from '../../../ui/icons/replicate-icon.component';
import { OllamaIconComponent } from '../../../ui/icons/ollama-icon.component';

@Component({
  selector: 'app-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, OpenRouterIconComponent, ClaudeIconComponent, ReplicateIconComponent, OllamaIconComponent],
  templateUrl: './model-selector.component.html',
  styleUrls: ['./model-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelSelectorComponent implements OnInit {
  private modelService = inject(ModelService);
  private settingsService = inject(SettingsService);

  @Input() placeholder = 'Select model...';
  @Input() clearable = false;
  @Input() searchable = true;
  @Input() appendTo = 'body'; // e.g., 'body'

  // Two-way bindable model id (provider-prefixed, e.g., 'openrouter:anthropic/claude-3-haiku')
  @Input() model = '';
  @Output() modelChange = new EventEmitter<string>();

  availableModels: ModelOption[] = [];

  ngOnInit(): void {
    this.modelService.loadAllModels().subscribe(({ openRouter, gemini, ollama, claude, replicate }) => {
      const enriched = [
        ...openRouter.map(m => ({ ...m, id: `openrouter:${m.id}` })),
        ...gemini.map(m => ({ ...m, id: `gemini:${m.id}` })),
        ...ollama.map(m => ({ ...m, id: `ollama:${m.id}` })),
        ...claude.map(m => ({ ...m, id: `claude:${m.id}` })),
        ...replicate.map(m => ({ ...m, id: `replicate:${m.id}` })),
      ];
      this.availableModels = enriched;
      // Initialize from settings if not set
      if (!this.model) {
        const settings = this.settingsService.getSettings();
        this.model = settings.selectedModel || enriched[0]?.id || '';
        this.modelChange.emit(this.model);
      }
    });
  }

  onModelChange(value: string): void {
    this.model = value;
    this.modelChange.emit(value);
  }

  getProviderIcon(provider: string): string {
    if (provider === 'gemini') return 'logoGoogle';
    if (provider === 'replicate') return 'gitNetworkOutline';
    if (provider === 'ollama') return 'hardwareChip';
    return 'globeOutline';
  }
}
