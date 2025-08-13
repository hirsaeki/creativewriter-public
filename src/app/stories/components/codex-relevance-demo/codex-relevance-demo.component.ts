import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodexRelevanceService, CodexEntry, RelevanceScore } from '../../../core/services/codex-relevance.service';

@Component({
  selector: 'app-codex-relevance-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './codex-relevance-demo.component.html',
  styleUrls: ['./codex-relevance-demo.component.scss']
})
export class CodexRelevanceDemoComponent {
  sampleEntries: CodexEntry[] = [
    {
      id: 'char-1',
      title: 'Emma Steinberg',
      category: 'character',
      content: 'Die mutige Archäologin, 32 Jahre alt, mit braunen Haaren und grünen Augen. Expertin für antike Artefakte.',
      aliases: ['Emma', 'Dr. Steinberg', 'Die Archäologin'],
      keywords: ['Archäologie', 'Artefakte', 'Forscherin'],
      importance: 'major',
      globalInclude: false
    },
    {
      id: 'char-2',
      title: 'Professor Klaus Weber',
      category: 'character',
      content: 'Emmas Mentor, 65 Jahre alt. Leiter des Archäologischen Instituts in Berlin.',
      aliases: ['Klaus', 'Der Professor', 'Weber'],
      keywords: ['Mentor', 'Institut', 'Berlin'],
      importance: 'minor',
      globalInclude: false
    },
    {
      id: 'loc-1',
      title: 'The Abandoned Castle',
      category: 'location',
      content: 'A medieval castle in the Bavarian Alps, uninhabited for 200 years. Mysterious atmosphere.',
      aliases: ['Castle', 'The Fortress', 'Falkenstein Castle'],
      keywords: ['medieval', 'Alps', 'abandoned', 'mysterious'],
      importance: 'major',
      globalInclude: false
    },
    {
      id: 'obj-1',
      title: 'The Magic Amulet',
      category: 'object',
      content: 'A golden amulet with engraved runes. Said to possess magical powers.',
      aliases: ['Amulet', 'The Talisman', 'The Golden Amulet'],
      keywords: ['magic', 'gold', 'runes', 'power'],
      importance: 'major',
      globalInclude: false
    },
    {
      id: 'char-3',
      title: 'The Villagers',
      category: 'character',
      content: 'The superstitious inhabitants of the nearby village who avoid the castle.',
      aliases: ['Village Folk', 'The Locals'],
      keywords: ['village', 'superstition', 'fear'],
      importance: 'background',
      globalInclude: false
    }
  ];
  
  testContext = 'Emma carefully enters the abandoned castle. The heavy wooden door creaks as she pushes it open. Inside it is dark and dusty. She thinks back to the villagers\' warning, but her curiosity about the amulet is stronger.';
  
  testPrompt = 'Describe Emma\'s feelings and thoughts as she explores the castle';
  
  relevanceScores: Record<string, RelevanceScore> = {};
  selectedEntries: CodexEntry[] | null = null;
  estimatedTokens = 0;
  
  private readonly relevanceService = inject(CodexRelevanceService);
  
  async analyzeRelevance() {
    // Calculate relevance scores for all entries
    this.relevanceScores = {};
    
    for (const entry of this.sampleEntries) {
      const score = (this.relevanceService as unknown as { calculateRelevanceScore: (entry: CodexEntry, context: string, settings: unknown) => number }).calculateRelevanceScore(
        entry,
        this.testContext,
        this.testPrompt
      );
      this.relevanceScores[entry.id] = {
        entryId: entry.id,
        score: score,
        reasons: [] // The service doesn't provide reasons in this demo
      };
    }
    
    // Get selected entries
    this.selectedEntries = await this.relevanceService.getRelevantEntries(
      this.sampleEntries,
      this.testContext,
      this.testPrompt,
      1000
    ).toPromise() || [];
    
    // Calculate estimated tokens
    this.estimatedTokens = Math.floor(
      this.selectedEntries.reduce((sum, entry) => sum + entry.content.length, 0) * 0.25
    );
  }
  
  getScore(entryId: string): string {
    const score = this.relevanceScores[entryId];
    return score ? score.score.toFixed(2) : '0.00';
  }
}