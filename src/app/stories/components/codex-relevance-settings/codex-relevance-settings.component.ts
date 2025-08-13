import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodexService } from '../../services/codex.service';
import { Codex, CodexEntry } from '../../models/codex.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-codex-relevance-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './codex-relevance-settings.component.html',
  styleUrls: ['./codex-relevance-settings.component.scss']
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