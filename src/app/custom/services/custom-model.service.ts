import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ModelService } from '../../core/services/model.service';
import { ModelOption } from '../../core/models/model.interface';
import { GeminiApiProxyService } from './gemini-api-proxy.service';

@Injectable({
  providedIn: 'root'
})
export class CustomModelService extends ModelService {
  private geminiProxyService = inject(GeminiApiProxyService);

  override loadGeminiModels(): Observable<ModelOption[]> {
    if (!this.geminiProxyService.isProxyEnabled()) {
      return super.loadGeminiModels();
    }

    return this.geminiProxyService.listModels().pipe(
      map(response => this.transformGeminiModels(response.models)),
      tap(models => {
        this.geminiModelsSubject.next(models);
      }),
      catchError(() => super.loadGeminiModels())
    );
  }

  private transformGeminiModels(models: { name: string; displayName: string; inputTokenLimit?: number; outputTokenLimit?: number }[]): ModelOption[] {
    return models
      .filter(model => model.name.includes('gemini'))
      .map(model => {
        const modelId = model.name.replace('models/', '');
        return {
          id: modelId,
          label: model.displayName || modelId,
          description: `Context: ${model.inputTokenLimit?.toLocaleString() || 'N/A'} input, ${model.outputTokenLimit?.toLocaleString() || 'N/A'} output`,
          costInputEur: this.estimateGeminiCost(modelId, 'input'),
          costOutputEur: this.estimateGeminiCost(modelId, 'output'),
          contextLength: model.inputTokenLimit || 1000000,
          provider: 'gemini' as const
        };
      })
      .sort((a, b) => {
        // Sort by version (2.5 before 1.5) then by tier (pro before flash)
        const getVersion = (id: string) => {
          if (id.includes('2.5')) return 1;
          if (id.includes('2.0')) return 2;
          if (id.includes('1.5')) return 3;
          return 4;
        };
        const getTier = (id: string) => {
          if (id.includes('pro')) return 1;
          if (id.includes('flash')) return 2;
          return 3;
        };
        const versionDiff = getVersion(a.id) - getVersion(b.id);
        if (versionDiff !== 0) return versionDiff;
        return getTier(a.id) - getTier(b.id);
      });
  }

  private estimateGeminiCost(modelId: string, type: 'input' | 'output'): string {
    const lowerName = modelId.toLowerCase();
    if (lowerName.includes('2.5-pro') || lowerName.includes('2.0-pro')) {
      return type === 'input' ? '3.50 €' : '10.50 €';
    }
    if (lowerName.includes('1.5-pro')) {
      return type === 'input' ? '3.50 €' : '10.50 €';
    }
    // Flash models are cheaper
    return type === 'input' ? '0.07 €' : '0.21 €';
  }
}
