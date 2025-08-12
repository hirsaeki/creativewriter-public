import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodexRelevanceService, CodexEntry, RelevanceScore } from '../../core/services/codex-relevance.service';

@Component({
  selector: 'app-codex-relevance-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="demo-container">
      <h3>Codex Relevance Demo</h3>
      <p class="description">
        Diese Demo zeigt, wie die AI relevante Codex-Einträge basierend auf dem Kontext auswählt.
      </p>
      
      <div class="demo-content">
        <div class="left-panel">
          <h4>Sample Codex Entries</h4>
          <div class="sample-entries">
            <div class="entry-card" *ngFor="let entry of sampleEntries">
              <div class="entry-header">
                <strong>{{ entry.title }}</strong>
                <span class="category">{{ entry.category }}</span>
                <span class="importance" [class]="entry.importance">{{ entry.importance }}</span>
              </div>
              <div class="entry-content">{{ entry.content }}</div>
              <div class="entry-meta">
                <span *ngIf="entry.aliases.length">Aliase: {{ entry.aliases.join(', ') }}</span>
                <span *ngIf="entry.keywords.length">Keywords: {{ entry.keywords.join(', ') }}</span>
              </div>
              <div class="relevance-score" *ngIf="relevanceScores[entry.id]">
                <strong>Score: {{ relevanceScores[entry.id].score.toFixed(2) }}</strong>
                <ul>
                  <li *ngFor="let reason of relevanceScores[entry.id].reasons">{{ reason }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div class="right-panel">
          <h4>Test Context</h4>
          <div class="form-group">
            <label for="scene-text">Szenen-Text:</label>
            <textarea 
              id="scene-text"
              [(ngModel)]="testContext"
              rows="6"
              placeholder="Gib hier den aktuellen Szenen-Text ein..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="beat-prompt">Beat Prompt:</label>
            <textarea 
              id="beat-prompt"
              [(ngModel)]="testPrompt"
              rows="3"
              placeholder="Gib hier den Beat-Prompt ein..."
            ></textarea>
          </div>
          
          <button (click)="analyzeRelevance()" class="analyze-btn">
            Relevanz analysieren
          </button>
          
          <div class="results" *ngIf="selectedEntries">
            <h4>Selected Entries ({{ selectedEntries.length }}):</h4>
            <div class="selected-entry" *ngFor="let entry of selectedEntries">
              <strong>{{ entry.title }}</strong>
              <span class="score">Score: {{ getScore(entry.id) }}</span>
            </div>
            
            <div class="token-info">
              <strong>Estimated Tokens:</strong> ~{{ estimatedTokens }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1rem 0;
    }
    
    h3 {
      color: #f8f9fa;
      margin-bottom: 0.5rem;
    }
    
    .description {
      color: #adb5bd;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    
    .demo-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    
    @media (max-width: 1024px) {
      .demo-content {
        grid-template-columns: 1fr;
      }
    }
    
    .left-panel, .right-panel {
      background: #2d2d2d;
      border-radius: 6px;
      padding: 1rem;
    }
    
    h4 {
      color: #f8f9fa;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    
    .sample-entries {
      display: grid;
      gap: 0.75rem;
    }
    
    .entry-card {
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 0.75rem;
      font-size: 0.85rem;
    }
    
    .entry-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    
    .entry-header strong {
      flex: 1;
      color: #f8f9fa;
    }
    
    .category {
      background: #495057;
      color: #f8f9fa;
      padding: 0.125rem 0.4rem;
      border-radius: 10px;
      font-size: 0.7rem;
    }
    
    .importance {
      padding: 0.125rem 0.4rem;
      border-radius: 10px;
      font-size: 0.7rem;
      color: white;
    }
    
    .importance.major {
      background: #dc3545;
    }
    
    .importance.minor {
      background: #0d6efd;
    }
    
    .importance.background {
      background: #6c757d;
    }
    
    .entry-content {
      color: #e0e0e0;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }
    
    .entry-meta {
      color: #6c757d;
      font-size: 0.8rem;
      margin-bottom: 0.5rem;
    }
    
    .entry-meta span {
      display: block;
    }
    
    .relevance-score {
      background: #0d0d0d;
      border: 1px solid #28a745;
      border-radius: 4px;
      padding: 0.5rem;
      margin-top: 0.5rem;
    }
    
    .relevance-score strong {
      color: #28a745;
      display: block;
      margin-bottom: 0.25rem;
    }
    
    .relevance-score ul {
      margin: 0;
      padding-left: 1.25rem;
      color: #adb5bd;
      font-size: 0.8rem;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      color: #adb5bd;
      margin-bottom: 0.25rem;
      font-size: 0.9rem;
    }
    
    textarea {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 0.5rem;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 0.9rem;
      resize: vertical;
    }
    
    textarea:focus {
      outline: none;
      border-color: #0d6efd;
    }
    
    .analyze-btn {
      background: #0d6efd;
      color: white;
      border: none;
      padding: 0.5rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      width: 100%;
      margin-bottom: 1rem;
    }
    
    .analyze-btn:hover {
      background: #0b5ed7;
    }
    
    .results {
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 1rem;
    }
    
    .results h4 {
      margin-bottom: 0.75rem;
      font-size: 1rem;
    }
    
    .selected-entry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: #0d0d0d;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    
    .selected-entry strong {
      color: #f8f9fa;
    }
    
    .score {
      color: #28a745;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .token-info {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid #404040;
      color: #adb5bd;
      font-size: 0.9rem;
    }
  `]
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