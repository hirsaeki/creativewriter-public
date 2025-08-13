import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodexService } from '../../services/codex.service';
import { CodexRelevanceService } from '../../../core/services/codex-relevance.service';
import { BeatAIService } from '../../../shared/services/beat-ai.service';

@Component({
  selector: 'app-codex-relevance-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './codex-relevance-test.component.html',
  styleUrls: ['./codex-relevance-test.component.scss']
})
export class CodexRelevanceTestComponent implements OnInit {
  private codexService = inject(CodexService);
  private codexRelevanceService = inject(CodexRelevanceService);
  private beatAIService = inject(BeatAIService);

  @Input() storyId!: string;
  
  sceneContext = '';
  beatPrompt = '';
  results: import('../../../core/services/codex-relevance.service').CodexEntry[] | null = null;
  
  ngOnInit() {
    // Set default test values
    this.sceneContext = 'Emma enters the abandoned castle. The old walls tell of bygone times. She searches for the magical amulet.';
    this.beatPrompt = 'Describe Emma\'s feelings when entering the castle';
  }
  
  async testRelevance() {
    // Get all codex entries and convert them
    const allCodexEntries = this.codexService.getAllCodexEntries(this.storyId);
    // Convert entries to the format expected by codex relevance service
    const convertedEntries: import('../../../core/services/codex-relevance.service').CodexEntry[] = [];
    
    for (const categoryData of allCodexEntries) {
      const categoryMap: Record<string, 'character' | 'location' | 'object' | 'lore' | 'other'> = {
        'Characters': 'character',
        'Locations': 'location', 
        'Objects': 'object',
        'Notes': 'other',
        'Lore': 'lore'
      };
      
      const category = categoryMap[categoryData.category] || 'other';
      
      for (const entry of categoryData.entries) {
        convertedEntries.push({
          id: entry.id,
          title: entry.title,
          category,
          content: entry.content,
          aliases: [], // Would need to extract from metadata
          keywords: entry.tags || [],
          importance: 'minor' as const,
          globalInclude: entry.alwaysInclude
        });
      }
    }
    
    // Get relevant entries
    this.results = await this.codexRelevanceService.getRelevantEntries(
      convertedEntries,
      this.sceneContext,
      this.beatPrompt,
      1000
    ).toPromise() || [];
  }
}