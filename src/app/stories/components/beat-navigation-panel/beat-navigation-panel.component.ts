import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton, IonChip, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, colorWandOutline, checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import { Story } from '../../models/story.interface';

interface BeatItem {
  beatId: string;
  prompt: string;
  position: number;
  isGenerating: boolean;
  hasContent: boolean;
}

@Component({
  selector: 'app-beat-navigation-panel',
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton, IonChip, IonLabel],
  templateUrl: './beat-navigation-panel.component.html',
  styleUrls: ['./beat-navigation-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BeatNavigationPanelComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() story: Story | null = null;
  @Input() activeSceneId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() opened = new EventEmitter<void>();
  @Output() beatSelected = new EventEmitter<string>();

  beats: BeatItem[] = [];

  constructor() {
    addIcons({ closeOutline, colorWandOutline, checkmarkCircle, ellipseOutline });
  }

  ngOnInit(): void {
    this.extractBeats();
  }

  close(): void {
    this.closed.emit();
  }

  openPanel(event: Event): void {
    event.stopPropagation();
    this.opened.emit();
  }

  selectBeat(beatId: string): void {
    this.beatSelected.emit(beatId);
  }

  private extractBeats(): void {
    // This will be called to extract beats from the current scene's content
    // For now, we'll leave it empty and populate from parent component
    this.beats = [];
  }

  updateBeats(beats: BeatItem[]): void {
    this.beats = beats;
    this.cdr.markForCheck();
  }

  getBeatPreview(prompt: string): string {
    const maxLength = 50;
    if (prompt.length <= maxLength) {
      return prompt;
    }
    return prompt.substring(0, maxLength) + '...';
  }

  getBeatStatusIcon(beat: BeatItem): string {
    if (beat.isGenerating) {
      return 'ellipse-outline';
    }
    if (beat.hasContent) {
      return 'checkmark-circle';
    }
    return 'ellipse-outline';
  }

  getBeatStatusColor(beat: BeatItem): string {
    if (beat.isGenerating) {
      return 'warning';
    }
    if (beat.hasContent) {
      return 'success';
    }
    return 'medium';
  }
}
