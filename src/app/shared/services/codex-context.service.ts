import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CodexRelevanceService, CodexEntry as CodexRelevanceEntry } from '../../core/services/codex-relevance.service';
import { CodexService } from '../../stories/services/codex.service';
import { CodexEntry, CustomField } from '../../stories/models/codex.interface';

@Injectable({ providedIn: 'root' })
export class CodexContextService {
  private codexService = inject(CodexService);
  private codexRelevanceService = inject(CodexRelevanceService);

  async buildCodexXml(
    storyId: string,
    contextText: string,
    promptText: string,
    maxTokens = 1000
  ): Promise<{ xml: string; categories: { category: string; entries: CodexEntry[]; icon?: string }[] }> {
    const allCodexEntries = this.codexService.getAllCodexEntries(storyId);
    if (allCodexEntries.length === 0) {
      return { xml: '', categories: [] };
    }

    const convertedEntries = this.convertCodexEntriesToRelevanceFormat(allCodexEntries);

    let relevantEntries: CodexRelevanceEntry[] = [];
    try {
      relevantEntries = await firstValueFrom(
        this.codexRelevanceService.getRelevantEntries(
          convertedEntries,
          contextText,
          promptText,
          maxTokens
        )
      );
    } catch (error) {
      console.error('Failed to calculate relevant codex entries:', error);
      relevantEntries = [];
    }

    const filteredCodexEntries = this.ensureNotesCategory(
      allCodexEntries,
      this.filterCodexEntriesByRelevance(allCodexEntries, relevantEntries)
    );

    const xml = filteredCodexEntries.length > 0
      ? this.buildCodexXmlString(filteredCodexEntries)
      : '';

    return {
      xml,
      categories: filteredCodexEntries
    };
  }

  private convertCodexEntriesToRelevanceFormat(
    codexEntries: { category: string; entries: CodexEntry[]; icon?: string }[]
  ): CodexRelevanceEntry[] {
    const converted: CodexRelevanceEntry[] = [];

    for (const categoryData of codexEntries) {
      const categoryMap: Record<string, 'character' | 'location' | 'object' | 'lore' | 'other'> = {
        'Characters': 'character',
        'Locations': 'location',
        'Objects': 'object',
        'Notes': 'other',
        'Lore': 'lore'
      };

      const category = categoryMap[categoryData.category] || 'other';

      for (const entry of categoryData.entries) {
        const aliases: string[] = [];
        if (entry.metadata?.['aliases']) {
          const aliasValue = entry.metadata['aliases'];
          if (typeof aliasValue === 'string' && aliasValue) {
            aliases.push(...aliasValue.split(',').map((a: string) => a.trim()).filter((a: string) => a));
          }
        }

        const keywords: string[] = entry.tags ? [...entry.tags] : [];

        const titleWords = entry.title.split(/\s+/)
          .filter(word => word.length > 3)
          .map(word => word.toLowerCase());
        keywords.push(...titleWords);

        let importance: 'major' | 'minor' | 'background' = 'minor';
        if (entry.metadata?.['storyRole']) {
          const role = entry.metadata['storyRole'];
          if (role === 'Protagonist' || role === 'Antagonist') {
            importance = 'major';
          } else if (role === 'Hintergrundcharakter') {
            importance = 'background';
          }
        }

        converted.push({
          id: entry.id,
          title: entry.title,
          category,
          content: entry.content || '',
          aliases,
          keywords,
          importance,
          globalInclude: !!(entry.metadata?.['globalInclude']) || entry.alwaysInclude || false,
          lastMentioned: entry.metadata?.['lastMentioned'] as number | undefined,
          mentionCount: entry.metadata?.['mentionCount'] as number | undefined
        });
      }
    }

    return converted;
  }

  private filterCodexEntriesByRelevance(
    allCodexEntries: { category: string; entries: CodexEntry[]; icon?: string }[],
    relevantEntries: CodexRelevanceEntry[]
  ): { category: string; entries: CodexEntry[]; icon?: string }[] {
    if (relevantEntries.length === 0) {
      return [];
    }

    const relevantIds = new Set(relevantEntries.map(entry => entry.id));
    return allCodexEntries
      .map(categoryData => ({
        ...categoryData,
        entries: categoryData.entries.filter(entry => relevantIds.has(entry.id))
      }))
      .filter(categoryData => categoryData.entries.length > 0);
  }

  private ensureNotesCategory(
    allCodexEntries: { category: string; entries: CodexEntry[]; icon?: string }[],
    filteredCodexEntries: { category: string; entries: CodexEntry[]; icon?: string }[]
  ): { category: string; entries: CodexEntry[]; icon?: string }[] {
    const result = [...filteredCodexEntries];
    const noteKeywords = ['notizen', 'notes', 'note'];

    const notesCategory = allCodexEntries.find(category =>
      noteKeywords.some(keyword => category.category.toLowerCase().includes(keyword))
    );

    if (notesCategory && notesCategory.entries.length > 0) {
      const existingNotesIndex = result.findIndex(category => category.category === notesCategory.category);
      if (existingNotesIndex >= 0) {
        result[existingNotesIndex] = notesCategory;
      } else {
        result.push(notesCategory);
      }
    }

    return result;
  }

  private buildCodexXmlString(
    categories: { category: string; entries: CodexEntry[]; icon?: string }[]
  ): string {
    const content = categories.map(categoryData => {
      const categoryType = this.getCategoryXmlType(categoryData.category);

      return categoryData.entries.map((entry: CodexEntry) => {
        let entryXml = `<${categoryType} name="${this.escapeXml(entry.title)}"`;

        if (entry.metadata?.['aliases']) {
          entryXml += ` aliases="${this.escapeXml(entry.metadata['aliases'])}"`;
        }

        if (entry.metadata?.['storyRole'] && categoryData.category === 'Characters') {
          entryXml += ` storyRole="${this.escapeXml(entry.metadata['storyRole'])}"`;
        }

        entryXml += '>\n';

        if (entry.content) {
          entryXml += `  <description>${this.escapeXml(entry.content)}</description>\n`;
        }

        const customFields = entry.metadata?.['customFields'] || [];
        if (Array.isArray(customFields)) {
          customFields.forEach((field: CustomField) => {
            const fieldName = this.sanitizeXmlTagName(field.name);
            entryXml += `  <${fieldName}>${this.escapeXml(field.value)}</${fieldName}>\n`;
          });
        }

        if (entry.metadata) {
          Object.entries(entry.metadata)
            .filter(([key]) => key !== 'storyRole' && key !== 'customFields' && key !== 'aliases')
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .forEach(([key, value]) => {
              const tagName = this.sanitizeXmlTagName(key);
              entryXml += `  <${tagName}>${this.escapeXml(String(value))}</${tagName}>\n`;
            });
        }

        entryXml += `</${categoryType}>`;
        return entryXml;
      }).join('\n');
    }).join('\n');

    return `<codex>\n${content}\n</codex>`;
  }

  private getCategoryXmlType(category: string): string {
    const mapping: Record<string, string> = {
      'Characters': 'character',
      'Locations': 'location',
      'Objects': 'item',
      'Notes': 'other'
    };
    return mapping[category] || 'other';
  }

  private sanitizeXmlTagName(name: string | unknown): string {
    const str = String(name || '');
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  private escapeXml(text: string | unknown): string {
    const str = String(text || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
