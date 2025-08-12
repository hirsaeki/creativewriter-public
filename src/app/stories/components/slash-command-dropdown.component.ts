import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlashCommand, SlashCommandAction, SlashCommandResult } from '../models/slash-command.interface';

@Component({
  selector: 'app-slash-command-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slash-dropdown" 
         [style.top.px]="position.top" 
         [style.left.px]="position.left"
         #dropdown>
      <div class="slash-dropdown-content">
        <div class="slash-dropdown-header">
          <span class="slash-icon">/</span>
          <span class="slash-title">Insert</span>
        </div>
        
        <div class="slash-commands">
          <div *ngFor="let command of commands; trackBy: trackCommand" 
               class="slash-command-item"
               role="button"
               tabindex="0"
               [class.active]="selectedIndex === getCommandIndex(command)"
               (click)="selectCommand(command)"
               (keyup.enter)="selectCommand(command)"
               (keyup.space)="selectCommand(command)"
               (mouseenter)="selectedIndex = getCommandIndex(command)">
            <span class="command-icon">{{ command.icon }}</span>
            <div class="command-content">
              <div class="command-label">{{ command.label }}</div>
              <div class="command-description">{{ command.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .slash-dropdown {
      position: absolute;
      z-index: 1000;
      background: #2d2d2d;
      border: 1px solid #404040;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      min-width: 280px;
      max-width: 320px;
    }
    
    .slash-dropdown-content {
      padding: 0.5rem;
    }
    
    .slash-dropdown-header {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #404040;
      margin-bottom: 0.5rem;
    }
    
    .slash-icon {
      background: #0d6efd;
      color: white;
      border-radius: 4px;
      padding: 0.25rem 0.5rem;
      font-weight: bold;
      font-size: 0.9rem;
      margin-right: 0.5rem;
    }
    
    .slash-title {
      color: #f8f9fa;
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .slash-commands {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .slash-command-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .slash-command-item:hover,
    .slash-command-item.active {
      background-color: #404040;
    }
    
    .command-icon {
      font-size: 1.25rem;
      margin-right: 0.75rem;
      width: 24px;
      text-align: center;
    }
    
    .command-content {
      flex: 1;
    }
    
    .command-label {
      color: #f8f9fa;
      font-weight: 500;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }
    
    .command-description {
      color: #adb5bd;
      font-size: 0.8rem;
      line-height: 1.3;
    }
  `]
})
export class SlashCommandDropdownComponent implements OnInit, OnDestroy {
  @Input() position: { top: number; left: number } = { top: 0, left: 0 };
  @Input() cursorPosition = 0;
  @Output() commandSelected = new EventEmitter<SlashCommandResult>();
  @Output() dismissed = new EventEmitter<void>();
  
  @ViewChild('dropdown', { static: true }) dropdown!: ElementRef;
  
  selectedIndex = 0;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private clickHandler: ((event: Event) => void) | null = null;
  
  commands: SlashCommand[] = [
    {
      id: 'story-beat',
      label: 'StoryBeat',
      description: 'Beat mit vollständigem Story-Kontext',
      icon: '📝',
      action: SlashCommandAction.INSERT_BEAT
    },
    {
      id: 'scene-beat',
      label: 'SceneBeat',
      description: 'Beat ohne Szenen-Zusammenfassungen',
      icon: '📄',
      action: SlashCommandAction.INSERT_SCENE_BEAT
    },
    {
      id: 'image',
      label: 'Insert image',
      description: 'Insert an image or description',
      icon: '🖼️',
      action: SlashCommandAction.INSERT_IMAGE
    }
  ];

  ngOnInit() {
    // Create bound handlers so we can properly remove them later
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.clickHandler = this.handleClickOutside.bind(this);
    
    // Listen for keyboard events
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('click', this.clickHandler);
  }

  ngOnDestroy() {
    // Remove event listeners using the same handler references
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }

  trackCommand(index: number, command: SlashCommand): string {
    return command.id;
  }

  getCommandIndex(command: SlashCommand): number {
    return this.commands.findIndex(c => c.id === command.id);
  }

  selectCommand(command: SlashCommand): void {
    this.commandSelected.emit({
      action: command.action,
      position: this.cursorPosition,
      data: { command }
    });
    // Emit dismissed event to close the dropdown
    this.dismissed.emit();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Only handle keys when dropdown is actually visible and focused
    if (!this.dropdown?.nativeElement) return;
    
    // Check if the dropdown is actually in the DOM
    if (!document.body.contains(this.dropdown.nativeElement)) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.commands.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (this.commands[this.selectedIndex]) {
          this.selectCommand(this.commands[this.selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.dismissed.emit();
        break;
    }
  }

  private handleClickOutside(event: Event): void {
    if (this.dropdown && !this.dropdown.nativeElement.contains(event.target as Node)) {
      this.dismissed.emit();
    }
  }
}