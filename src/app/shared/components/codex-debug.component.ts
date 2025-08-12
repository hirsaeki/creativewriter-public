import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodexService } from '../../stories/services/codex.service';
import { CodexEntry, Codex } from '../../stories/models/codex.interface';

@Component({
  selector: 'app-codex-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="codex-debug" *ngIf="showDebug">
      <h4>Codex Debug for Story: {{storyId}}</h4>
      <div *ngIf="codexEntries.length > 0">
        <p><strong>{{codexEntries.length}} entries found:</strong></p>
        <ul>
          <li *ngFor="let entry of codexEntries">
            <strong>{{entry.title}}</strong>
            <span *ngIf="entry.tags && entry.tags.length > 0"> 
              (Tags: {{entry.tags.join(', ')}})
            </span>
          </li>
        </ul>
      </div>
      <div *ngIf="codexEntries.length === 0">
        <p>No Codex entries found.</p>
      </div>
    </div>
  `,
  styles: [`
    .codex-debug {
      background: #2d2d2d;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
      color: #e0e0e0;
      font-size: 0.9rem;
    }
    .codex-debug h4 {
      margin: 0 0 0.5rem 0;
      color: #4dabf7;
    }
    .codex-debug ul {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    .codex-debug li {
      margin: 0.25rem 0;
    }
  `]
})
export class CodexDebugComponent implements OnInit {
  @Input() storyId?: string;
  @Input() showDebug = false;
  
  codexEntries: CodexEntry[] = [];

  private readonly codexService = inject(CodexService);

  ngOnInit(): void {
    if (this.storyId) {
      this.codexService.codex$.subscribe(codexMap => {
        const codex = codexMap.get(this.storyId!);
        if (codex) {
          this.codexEntries = this.extractAllEntries(codex);
        } else {
          this.codexEntries = [];
        }
      });
    }
  }

  private extractAllEntries(codex: Codex): CodexEntry[] {
    const entries: CodexEntry[] = [];
    
    if (codex.categories) {
      for (const category of codex.categories) {
        if (category.entries) {
          entries.push(...category.entries);
        }
      }
    }
    
    return entries;
  }
}