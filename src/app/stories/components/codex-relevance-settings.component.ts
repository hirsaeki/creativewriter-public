import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodexService } from '../services/codex.service';
import { Codex, CodexEntry } from '../models/codex.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-codex-relevance-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relevance-settings">
      <div class="settings-header">
        <h4>Codex Relevance Settings</h4>
        <p class="description">
          Choose which entries should always be sent to the AI (Global) 
          and which should only be included when relevant.
        </p>
      </div>
      
      <div class="categories" *ngIf="codex">
        <div class="category-section" *ngFor="let category of codex.categories">
          <h5>{{ category.title }}</h5>
          
          <div class="entries-list">
            <div class="entry-item" *ngFor="let entry of category.entries">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  [(ngModel)]="globalIncludes[entry.id]"
                  (change)="updateGlobalInclude(entry.id, $event)"
                />
                <span class="entry-title">{{ entry.title }}</span>
                <span class="entry-type" *ngIf="entry.metadata?.['storyRole']">
                  ({{ entry.metadata?.['storyRole'] }})
                </span>
              </label>
              
              <div class="aliases" *ngIf="entry.metadata?.['aliases']">
                <input 
                  type="text" 
                  [ngModel]="entry.metadata?.['aliases'] || ''"
                  (ngModelChange)="updateEntryAliases(entry.id, $event)"
                  (blur)="updateAliases(entry.id, $event)"
                  placeholder="Aliase (kommagetrennt)"
                  class="alias-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-footer">
        <div class="info">
          <strong>Tipp:</strong> Markiere nur die wichtigsten Charaktere und Orte als global. 
          Zu viele globale Einträge können die AI-Kosten erhöhen und die Qualität beeinträchtigen.
        </div>
      </div>
    </div>
  `,
  styles: [`
    .relevance-settings {
      background: #2d2d2d;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1rem 0;
    }
    
    .settings-header {
      margin-bottom: 1.5rem;
    }
    
    .settings-header h4 {
      color: #f8f9fa;
      margin-bottom: 0.5rem;
    }
    
    .description {
      color: #adb5bd;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    .categories {
      display: grid;
      gap: 1.5rem;
    }
    
    .category-section h5 {
      color: #e9ecef;
      margin-bottom: 0.75rem;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .entries-list {
      display: grid;
      gap: 0.75rem;
    }
    
    .entry-item {
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 6px;
      padding: 0.75rem;
    }
    
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      margin-bottom: 0.5rem;
    }
    
    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    
    .entry-title {
      color: #f8f9fa;
      font-weight: 500;
    }
    
    .entry-type {
      color: #6c757d;
      font-size: 0.85rem;
      font-style: italic;
    }
    
    .aliases {
      margin-left: 1.75rem;
    }
    
    .alias-input {
      width: 100%;
      background: #0d0d0d;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 0.375rem 0.5rem;
      color: #e0e0e0;
      font-size: 0.85rem;
    }
    
    .alias-input:focus {
      outline: none;
      border-color: #0d6efd;
    }
    
    .settings-footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #404040;
    }
    
    .info {
      background: #1a1a1a;
      border: 1px solid #495057;
      border-radius: 6px;
      padding: 0.75rem;
      color: #adb5bd;
      font-size: 0.85rem;
      line-height: 1.4;
    }
    
    .info strong {
      color: #f8f9fa;
    }
  `]
})
export class CodexRelevanceSettingsComponent implements OnInit, OnDestroy {
  private codexService = inject(CodexService);

  @Input() storyId!: string;
  
  codex: Codex | null = null;
  globalIncludes: Record<string, boolean> = {};
  private subscription = new Subscription();
  
  ngOnInit() {
    this.loadCodex();
  }
  
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  
  async loadCodex() {
    const codex = await this.codexService.getCodex(this.storyId);
    if (codex) {
      this.codex = codex;
      
      // Initialize global includes from metadata
      for (const category of codex.categories) {
        for (const entry of category.entries) {
          this.globalIncludes[entry.id] = !!(entry.metadata?.['globalInclude']) || false;
        }
      }
    }
  }
  
  async updateGlobalInclude(entryId: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const isGlobal = checkbox.checked;
    
    // Find the entry and update its metadata
    for (const category of this.codex?.categories || []) {
      const entry = category.entries.find((e: CodexEntry) => e.id === entryId);
      if (entry) {
        if (!entry.metadata) {
          entry.metadata = {};
        }
        entry.metadata['globalInclude'] = isGlobal;
        
        // Save the updated entry
        await this.codexService.updateEntry(this.storyId, category.id, entry.id, entry);
        break;
      }
    }
  }
  
  updateEntryAliases(entryId: string, aliases: string) {
    this.updateAliasesInternal(entryId, aliases);
  }

  async updateAliases(entryId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const aliases = input.value;
    this.updateAliasesInternal(entryId, aliases);
  }

  private async updateAliasesInternal(entryId: string, aliases: string) {
    
    // Find the entry and update its metadata
    for (const category of this.codex?.categories || []) {
      const entry = category.entries.find((e: CodexEntry) => e.id === entryId);
      if (entry) {
        if (!entry.metadata) {
          entry.metadata = {};
        }
        entry.metadata['aliases'] = aliases;
        
        // Save the updated entry
        await this.codexService.updateEntry(this.storyId, category.id, entry.id, entry);
        break;
      }
    }
  }
}