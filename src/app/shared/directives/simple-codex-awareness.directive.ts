import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { Subscription, debounceTime, distinctUntilChanged, fromEvent } from 'rxjs';
import { CodexService } from '../../stories/services/codex.service';
import { CodexEntry, Codex } from '../../stories/models/codex.interface';

interface HTMLTextAreaElementWithOverlay extends HTMLTextAreaElement {
  __codexOverlay?: HTMLElement;
}

@Directive({
  selector: '[appSimpleCodexAwareness]',
  standalone: true
})
export class SimpleCodexAwarenessDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private codexService = inject(CodexService);

  @Input() storyId?: string;
  @Input() enableHighlighting = true;
  
  private subscription = new Subscription();
  private allCodexEntries: CodexEntry[] = [];
  private processedContent = '';

  ngOnInit(): void {
    if (!this.storyId) {
      console.warn('SimpleCodexAwareness directive: storyId is required');
      return;
    }

    this.loadCodexEntries();
    this.setupInputListener();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadCodexEntries(): void {
    this.subscription.add(
      this.codexService.codex$.subscribe(codexMap => {
        const codex = codexMap.get(this.storyId!);
        if (codex) {
          this.allCodexEntries = this.extractAllEntries(codex);
          this.processContent();
        }
      })
    );
  }

  private setupInputListener(): void {
    const inputEvents = fromEvent(this.el.nativeElement, 'input');
    
    this.subscription.add(
      inputEvents.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.processContent();
      })
    );
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

  private processContent(): void {
    if (!this.enableHighlighting) return;
    
    const element = this.el.nativeElement;
    const content = element.textContent || element.innerText || '';
    
    if (content === this.processedContent) return;
    this.processedContent = content;

    // Clear existing highlights
    this.clearHighlights();
    
    // Apply new highlights
    this.applyHighlights(content);
  }

  private applyHighlights(content: string): void {
    if (!content || this.allCodexEntries.length === 0) return;
    
    const element = this.el.nativeElement;
    const contentLower = content.toLowerCase();
    const matches: TextMatch[] = [];
    
    // Find all matches
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
    }
    
    // Apply highlights to text content
    this.highlightMatches(element, content, matches);
  }

  private findWordMatches(content: string, searchTerm: string): { start: number, end: number, originalText: string }[] {
    const matches: { start: number, end: number, originalText: string }[] = [];
    const regex = new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, 'gi');
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        originalText: match[0]
      });
    }
    
    return matches;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private highlightMatches(element: HTMLElement, content: string, matches: TextMatch[]): void {
    if (matches.length === 0) return;
    
    // Handle textarea elements differently (they can't contain HTML)
    if (element.tagName.toLowerCase() === 'textarea') {
      this.highlightTextarea(element as HTMLTextAreaElement, content, matches);
      return;
    }
    
    // Clear the element and rebuild with safe DOM manipulation
    element.textContent = '';
    
    // Sort matches by position (ascending for proper reconstruction)
    matches.sort((a, b) => a.start - b.start);
    
    let lastIndex = 0;
    
    for (const match of matches) {
      // Add text before the match
      if (match.start > lastIndex) {
        const textNode = document.createTextNode(content.slice(lastIndex, match.start));
        element.appendChild(textNode);
      }
      
      // Create highlighted span using DOM methods
      const span = document.createElement('span');
      span.className = `codex-highlight codex-${match.type}`;
      span.title = `${match.entry.title} (${match.type})`;
      span.style.textDecoration = 'underline';
      span.style.textDecorationStyle = 'dotted';
      span.style.textDecorationColor = this.getHighlightColor(match.type);
      span.style.cursor = 'help';
      span.textContent = content.slice(match.start, match.end);
      element.appendChild(span);
      
      lastIndex = match.end;
    }
    
    // Add remaining text after last match
    if (lastIndex < content.length) {
      const textNode = document.createTextNode(content.slice(lastIndex));
      element.appendChild(textNode);
    }
  }

  private highlightTextarea(textarea: HTMLTextAreaElement, content: string, matches: TextMatch[]): void {
    // For textareas, we create an overlay element to show highlighting
    if (matches.length > 0) {
      textarea.classList.add('codex-matches-found');
      textarea.title = `Gefundene Codex-Einträge: ${matches.map(m => m.entry.title).join(', ')}`;
      
      // Create or update overlay
      this.createTextareaOverlay(textarea, content, matches);
    } else {
      textarea.classList.remove('codex-matches-found');
      textarea.title = '';
      this.removeTextareaOverlay(textarea);
    }
  }

  private createTextareaOverlay(textarea: HTMLTextAreaElement, content: string, matches: TextMatch[]): void {
    const container = textarea.parentElement;
    if (!container) return;

    // Remove existing overlay
    this.removeTextareaOverlay(textarea);

    // Create overlay div
    const overlay = this.renderer.createElement('div');
    this.renderer.addClass(overlay, 'codex-textarea-overlay');
    
    // Copy textarea styles to overlay
    const computedStyle = window.getComputedStyle(textarea);
    this.renderer.setStyle(overlay, 'position', 'absolute');
    this.renderer.setStyle(overlay, 'top', '0');
    this.renderer.setStyle(overlay, 'left', '0');
    this.renderer.setStyle(overlay, 'width', '100%');
    this.renderer.setStyle(overlay, 'height', '100%');
    this.renderer.setStyle(overlay, 'pointer-events', 'none');
    this.renderer.setStyle(overlay, 'z-index', '1');
    this.renderer.setStyle(overlay, 'overflow', 'hidden');
    this.renderer.setStyle(overlay, 'font-family', computedStyle.fontFamily);
    this.renderer.setStyle(overlay, 'font-size', computedStyle.fontSize);
    this.renderer.setStyle(overlay, 'line-height', computedStyle.lineHeight);
    this.renderer.setStyle(overlay, 'padding', computedStyle.padding);
    this.renderer.setStyle(overlay, 'border', 'transparent');
    this.renderer.setStyle(overlay, 'white-space', 'pre-wrap');
    this.renderer.setStyle(overlay, 'word-wrap', 'break-word');
    this.renderer.setStyle(overlay, 'color', 'transparent');
    this.renderer.setStyle(overlay, 'background', 'transparent');
    
    // Create highlighted content
    let highlightedHtml = content;
    
    // Sort matches by position (descending to avoid index shifting)
    matches.sort((a, b) => b.start - a.start);
    
    // Apply highlights from end to beginning
    for (const match of matches) {
      const before = highlightedHtml.slice(0, match.start);
      const matchText = highlightedHtml.slice(match.start, match.end);
      const after = highlightedHtml.slice(match.end);
      
      const color = this.getHighlightColor(match.type);
      const highlightedText = `<span style="background-color: ${color}; opacity: 0.3; border-radius: 2px;">${matchText}</span>`;
      
      highlightedHtml = before + highlightedText + after;
    }
    
    this.renderer.setProperty(overlay, 'innerHTML', highlightedHtml);
    
    // Make container relative if not already
    if (computedStyle.position === 'static') {
      this.renderer.setStyle(container, 'position', 'relative');
    }
    
    // Insert overlay
    this.renderer.insertBefore(container, overlay, textarea);
    
    // Store reference for cleanup
    (textarea as HTMLTextAreaElementWithOverlay).__codexOverlay = overlay;
  }

  private removeTextareaOverlay(textarea: HTMLTextAreaElement): void {
    const overlay = (textarea as HTMLTextAreaElementWithOverlay).__codexOverlay;
    if (overlay && overlay.parentNode) {
      this.renderer.removeChild(overlay.parentNode, overlay);
      delete (textarea as HTMLTextAreaElementWithOverlay).__codexOverlay;
    }
  }

  private getHighlightColor(type: string): string {
    const colors = {
      title: '#4dabf7',  // Blue for titles
      tag: '#51cf66',    // Green for tags
      default: '#ffd43b' // Yellow for default
    };
    
    return colors[type as keyof typeof colors] || colors.default;
  }

  private clearHighlights(): void {
    const element = this.el.nativeElement;
    
    // Handle textarea elements differently
    if (element.tagName.toLowerCase() === 'textarea') {
      element.classList.remove('codex-matches-found');
      element.title = '';
      this.removeTextareaOverlay(element);
      return;
    }
    
    const highlights = element.querySelectorAll('.codex-highlight');
    
    highlights.forEach((highlight: Element) => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.insertBefore(document.createTextNode(highlight.textContent || ''), highlight);
        parent.removeChild(highlight);
      }
    });
    
    // Normalize text nodes
    element.normalize();
  }
}

interface TextMatch {
  start: number;
  end: number;
  originalText: string;
  entry: CodexEntry;
  type: 'title' | 'tag';
}