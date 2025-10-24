import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonFooter,
  IonSpinner,
  ModalController,
  AlertController,
  LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, timeOutline, trashOutline, checkmarkCircle, chevronDown, chevronUp } from 'ionicons/icons';
import { BeatHistoryService } from '../../../shared/services/beat-history.service';
import { ProseMirrorEditorService } from '../../../shared/services/prosemirror-editor.service';
import { BeatVersion } from '../../models/beat-version-history.interface';

@Component({
  selector: 'app-beat-version-history-modal',
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonLabel,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCardContent,
    IonFooter,
    IonSpinner
  ],
  templateUrl: './beat-version-history-modal.component.html',
  styleUrls: ['./beat-version-history-modal.component.css']
})
export class BeatVersionHistoryModalComponent implements OnInit {
  @Input() beatId!: string;
  @Input() currentPrompt!: string;
  @Input() storyId!: string;

  versions: (BeatVersion & { expanded?: boolean })[] = [];
  loading = false;
  error: string | null = null;

  private readonly modalController = inject(ModalController);
  private readonly beatHistoryService = inject(BeatHistoryService);
  private readonly proseMirrorService = inject(ProseMirrorEditorService);
  private readonly alertController = inject(AlertController);
  private readonly loadingController = inject(LoadingController);

  constructor() {
    addIcons({ close, timeOutline, trashOutline, checkmarkCircle, chevronDown, chevronUp });
  }

  async ngOnInit() {
    await this.loadHistory();
  }

  async loadHistory() {
    this.loading = true;
    this.error = null;

    try {
      const history = await this.beatHistoryService.getHistory(this.beatId);

      if (history) {
        // Sort by newest first and add expanded flag
        // Convert generatedAt to Date if it's a string
        this.versions = history.versions
          .map(v => ({
            ...v,
            generatedAt: typeof v.generatedAt === 'string' ? new Date(v.generatedAt) : v.generatedAt,
            expanded: false
          }))
          .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
      } else {
        this.versions = [];
      }
    } catch (error) {
      console.error('[BeatVersionHistoryModal] Error loading history:', error);
      this.error = 'Failed to load version history. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Format version label (e.g., "Version 3")
   */
  formatVersionLabel(version: BeatVersion): string {
    const index = this.versions.indexOf(version as BeatVersion & { expanded?: boolean });
    return `Version ${this.versions.length - index}`;
  }

  /**
   * Format timestamp as relative time
   */
  formatTimestamp(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /**
   * Get preview text (first 150 characters)
   */
  getPreview(content: string): string {
    // Convert to plain text while preserving newlines
    const textContent = this.htmlToPlainText(content);
    return textContent.length > 150
      ? textContent.substring(0, 150) + '...'
      : textContent;
  }

  /**
   * Get full text content without HTML, preserving newlines
   */
  getFullText(content: string): string {
    return this.htmlToPlainText(content);
  }

  /**
   * Convert HTML to plain text while preserving formatting
   */
  private htmlToPlainText(html: string): string {
    // Replace paragraph and div end tags with newlines
    let text = html.replace(/<\/(p|div)>/gi, '\n');
    // Replace br tags with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // Replace closing heading tags with double newlines for spacing
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    // Strip remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    // Trim excess whitespace but preserve intentional newlines
    text = text.replace(/\n\n\n+/g, '\n\n'); // Max 2 consecutive newlines
    return text.trim();
  }

  /**
   * Toggle expanded state for a version
   */
  toggleExpanded(version: BeatVersion & { expanded?: boolean }) {
    version.expanded = !version.expanded;
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(version: BeatVersion) {
    if (version.isCurrent) {
      return; // Already current
    }

    const alert = await this.alertController.create({
      header: 'Restore Version',
      message: 'Replace current beat content with this version?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Restore',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Restoring version...'
            });
            await loading.present();

            try {
              await this.proseMirrorService.switchBeatVersion(this.beatId, version.versionId);

              // Reload history to update current flags
              await this.loadHistory();

              await loading.dismiss();

              // Notify parent that version was changed
              await this.modalController.dismiss({ versionChanged: true });
            } catch (error) {
              await loading.dismiss();
              console.error('[BeatVersionHistoryModal] Error restoring version:', error);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to restore version. Please try again.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Delete all history for this beat
   */
  async deleteHistory() {
    const alert = await this.alertController.create({
      header: 'Delete History',
      message: 'Delete all version history for this beat? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting history...'
            });
            await loading.present();

            try {
              await this.beatHistoryService.deleteHistory(this.beatId);
              this.versions = [];
              await loading.dismiss();

              // Close modal after deletion
              await this.modalController.dismiss({ historyDeleted: true });
            } catch (error) {
              await loading.dismiss();
              console.error('[BeatVersionHistoryModal] Error deleting history:', error);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to delete history. Please try again.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Close modal
   */
  dismiss() {
    this.modalController.dismiss();
  }

  /**
   * TrackBy function for ngFor performance
   */
  trackByVersionId(index: number, version: BeatVersion): string {
    return version.versionId;
  }
}
