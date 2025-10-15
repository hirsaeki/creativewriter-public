import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PromptTemplateService {
  private readonly cache = new Map<string, Promise<string>>();
  private http = inject(HttpClient);

  getSceneSummaryTemplate(): Promise<string> {
    return this.loadTemplate('assets/prompts/scene-summary-default.txt');
  }

  private loadTemplate(path: string): Promise<string> {
    let cached = this.cache.get(path);
    if (!cached) {
      cached = firstValueFrom(this.http.get(path, { responseType: 'text' }))
        .then(content => content)
        .catch(error => {
          this.cache.delete(path);
          throw error;
        });
      this.cache.set(path, cached);
    }
    return cached;
  }
}
