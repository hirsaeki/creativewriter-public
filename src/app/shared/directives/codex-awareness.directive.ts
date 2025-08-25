import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2, OnChanges, SimpleChanges, inject } from '@angular/core';
import { Subscription, BehaviorSubject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CodexService } from '../../stories/services/codex.service';
import { CodexEntry, Codex } from '../../stories/models/codex.interface';

@Directive({
  selector: '[appCodexAwareness]',
  standalone: true
})
export class CodexAwarenessDirective implements OnInit, OnDestroy, OnChanges {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private codexService = inject(CodexService);

  @Input() storyId?: string;
  @Input() enableHighlighting = true;
  @Input() debounceTime = 500;
  @Input() maxMatches = 50; // Performance limit
  
  private subscription = new Subscription();
  private contentSubject = new BehaviorSubject<string>('');
  private allCodexEntries: CodexEntry[] = [];
  private matchCache = new Map<string, CodexMatch[]>();
  private isProcessing = false;
  
  // Track the original content to restore if needed
  private originalContent = '';

  ngOnInit(): void {
    if (!this.storyId) {
      console.warn('CodexAwareness directive: storyId is required');
      return;
    }

    // Subscribe to codex changes
    this.subscription.add(
      this.codexService.codex$.subscribe(codexMap => {
        const codex = codexMap.get(this.storyId!);
        if (codex) {
          this.allCodexEntries = this.extractAllEntries(codex);
          this.processCurrentContent();
        }
      })
    );

    // Set up content processing with debounce
    this.subscription.add(
      this.contentSubject.pipe(
        debounceTime(this.debounceTime),
        distinctUntilChanged()
      ).subscribe(content => {
        this.processContent(content);
      })
    );

    // Set up mutation observer to watch for content changes
    this.setupMutationObserver();
    
    // Initial processing
    this.processCurrentContent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['storyId'] && !changes['storyId'].isFirstChange()) {
      this.clearCache();
      this.processCurrentContent();
    }
    
    if (changes['enableHighlighting'] && !changes['enableHighlighting'].isFirstChange()) {
      if (this.enableHighlighting) {
        this.processCurrentContent();
      } else {
        this.clearHighlights();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.clearHighlights();
  }

  private setupMutationObserver(): void {
    const observer = new MutationObserver((mutations) => {
      if (this.isProcessing) return;
      
      let shouldProcess = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          shouldProcess = true;
          break;
        }
      }
      
      if (shouldProcess) {
        this.processCurrentContent();
      }
    });

    observer.observe(this.el.nativeElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Store observer for cleanup
    this.subscription.add(() => observer.disconnect());
  }

  private processCurrentContent(): void {
    if (!this.enableHighlighting) return;
    
    const content = this.getTextContent();
    if (content !== this.originalContent) {
      this.originalContent = content;
      this.contentSubject.next(content);
    }
  }

  private processContent(content: string): void {
    if (this.isProcessing || !this.enableHighlighting) return;
    
    this.isProcessing = true;
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(content);
      let matches = this.matchCache.get(cacheKey);
      
      if (!matches) {
        matches = this.findMatches(content);
        this.matchCache.set(cacheKey, matches);
        
        // Limit cache size
        if (this.matchCache.size > 100) {
          const firstKey = this.matchCache.keys().next().value;
          if (firstKey) {
            this.matchCache.delete(firstKey);
          }
        }
      }
      
      this.applyHighlights(matches);
    } finally {
      this.isProcessing = false;
    }
  }

  private extractAllEntries(codex: Codex): CodexEntry[] {
    const entries: CodexEntry[] = [];
    
    if (codex.categories) {
      for (const category of codex.categories) {
        if (category.entries) {
          // Create deep copies of entries to prevent mutation
          const copiedEntries = category.entries.map(entry => ({
            ...entry,
            tags: entry.tags ? [...entry.tags] : []
          }));
          entries.push(...copiedEntries);
        }
      }
    }
    
    return entries;
  }

  private findMatches(content: string): CodexMatch[] {
    const matches: CodexMatch[] = [];
    const contentLower = content.toLowerCase();
    
    for (const entry of this.allCodexEntries) {
      // Check entry title
      const titleMatches = this.findWordMatches(contentLower, entry.title.toLowerCase());
      for (const match of titleMatches) {
        matches.push({
          ...match,
          entry,
          type: 'title'
        });
      }
      
      // Check tags if available
      if (entry.tags && entry.tags.length > 0) {
        for (const tag of entry.tags) {
          if (typeof tag === 'string') {
            const tagMatches = this.findWordMatches(contentLower, tag.toLowerCase());
            for (const match of tagMatches) {
              matches.push({
                ...match,
                entry,
                type: 'tag'
              });
            }
          }
        }
      }
      
      // Performance limit
      if (matches.length >= this.maxMatches) {
        break;
      }
    }
    
    // Sort by position to apply highlights in order
    return matches.sort((a, b) => a.start - b.start);
  }

  private findWordMatches(content: string, searchTerm: string): { start: number, end: number, text: string }[] {
    const matches: { start: number, end: number, text: string }[] = [];
    const regex = new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, 'gi');
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
    
    return matches;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private applyHighlights(matches: CodexMatch[]): void {
    if (matches.length === 0) return;
    
    const element = this.el.nativeElement;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes: Text[] = [];
    let node;
    
    while ((node = walker.nextNode()) !== null) {
      textNodes.push(node as Text);
    }
    
    let currentOffset = 0;
    const nodesToReplace: { node: Text, replacements: HTMLElement[] }[] = [];
    
    for (const textNode of textNodes) {
      const nodeText = textNode.textContent || '';
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeText.length;
      
      // Find matches that overlap with this text node
      const nodeMatches = matches.filter(match => 
        match.start < nodeEnd && match.end > nodeStart
      );
      
      if (nodeMatches.length > 0) {
        const replacements = this.createHighlightedElements(nodeText, nodeMatches, nodeStart);
        if (replacements.length > 0) {
          nodesToReplace.push({ node: textNode, replacements });
        }
      }
      
      currentOffset = nodeEnd;
    }
    
    // Apply replacements
    for (const { node, replacements } of nodesToReplace) {
      const parent = node.parentNode;
      if (parent) {
        for (const replacement of replacements) {
          parent.insertBefore(replacement, node);
        }
        parent.removeChild(node);
      }
    }
  }

  private createHighlightedElements(
    nodeText: string, 
    matches: CodexMatch[], 
    nodeOffset: number
  ): HTMLElement[] {
    const elements: HTMLElement[] = [];
    let lastIndex = 0;
    
    for (const match of matches) {
      const relativeStart = Math.max(0, match.start - nodeOffset);
      const relativeEnd = Math.min(nodeText.length, match.end - nodeOffset);
      
      // Add text before match
      if (relativeStart > lastIndex) {
        const textBefore = nodeText.slice(lastIndex, relativeStart);
        elements.push(this.createTextElement(textBefore));
      }
      
      // Add highlighted match
      const matchText = nodeText.slice(relativeStart, relativeEnd);
      elements.push(this.createHighlightElement(matchText, match));
      
      lastIndex = relativeEnd;
    }
    
    // Add remaining text
    if (lastIndex < nodeText.length) {
      const textAfter = nodeText.slice(lastIndex);
      elements.push(this.createTextElement(textAfter));
    }
    
    return elements;
  }

  private createTextElement(text: string): HTMLElement {
    const span = this.renderer.createElement('span');
    this.renderer.appendChild(span, this.renderer.createText(text));
    return span;
  }

  private createHighlightElement(text: string, match: CodexMatch): HTMLElement {
    const span = this.renderer.createElement('span');
    this.renderer.addClass(span, 'codex-highlight');
    this.renderer.addClass(span, `codex-${match.type}`);
    this.renderer.setAttribute(span, 'title', `${match.entry.title} (${match.type})`);
    
    // Add category-specific styling
    if (match.entry.categoryId) {
      this.renderer.addClass(span, `codex-category-${match.entry.categoryId}`);
    }
    
    // Add styles
    this.renderer.setStyle(span, 'text-decoration', 'underline');
    this.renderer.setStyle(span, 'text-decoration-style', 'dotted');
    this.renderer.setStyle(span, 'cursor', 'help');
    
    // Color based on category or type
    const color = this.getHighlightColor(match);
    this.renderer.setStyle(span, 'text-decoration-color', color);
    
    this.renderer.appendChild(span, this.renderer.createText(text));
    return span;
  }

  private getHighlightColor(match: CodexMatch): string {
    // Default colors for different types
    const colors = {
      title: '#4dabf7',  // Blue for titles
      tag: '#51cf66',    // Green for tags
      default: '#ffd43b' // Yellow for default
    };
    
    return colors[match.type] || colors.default;
  }

  private clearHighlights(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const element = this.el.nativeElement;
      const highlights = element.querySelectorAll('.codex-highlight');
      
      for (const highlight of highlights) {
        const parent = highlight.parentNode;
        if (parent) {
          parent.insertBefore(this.renderer.createText(highlight.textContent || ''), highlight);
          parent.removeChild(highlight);
        }
      }
      
      // Normalize text nodes
      element.normalize();
    } finally {
      this.isProcessing = false;
    }
  }

  private clearCache(): void {
    this.matchCache.clear();
  }

  private generateCacheKey(content: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getTextContent(): string {
    return this.el.nativeElement.textContent || '';
  }
}

interface CodexMatch {
  start: number;
  end: number;
  text: string;
  entry: CodexEntry;
  type: 'title' | 'tag';
}