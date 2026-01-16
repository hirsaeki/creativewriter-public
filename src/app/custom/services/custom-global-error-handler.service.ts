import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { GlobalErrorHandlerService } from '../../core/services/global-error-handler.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class CustomGlobalErrorHandlerService extends GlobalErrorHandlerService implements ErrorHandler {
  private readonly i18n = inject(I18nService);
  private readonly alertCtrl = inject(AlertController);
  private readonly zone = inject(NgZone);

  private chunkAlertShown = false;

  override handleError(error: unknown): void {
    if (this.isChunkError(error) && !this.chunkAlertShown) {
      this.showChunkErrorAlert(error);
      return;
    }
    super.handleError(error);
  }

  private isChunkError(error: unknown): boolean {
    if (!error) return false;

    let errorMessage = '';
    if (error instanceof Error) {
      errorMessage = error.message || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    const errorName = error instanceof Error ? error.name : '';
    const lowerMessage = errorMessage.toLowerCase();

    return (
      errorName === 'ChunkLoadError' ||
      lowerMessage.includes('loading chunk') ||
      lowerMessage.includes('chunk failed') ||
      lowerMessage.includes('failed to fetch dynamically imported module') ||
      lowerMessage.includes('error loading dynamically imported module') ||
      (lowerMessage.includes('404') && lowerMessage.includes('.js')) ||
      (lowerMessage.includes('failed to load') && lowerMessage.includes('module'))
    );
  }

  private showChunkErrorAlert(error: unknown): void {
    this.chunkAlertShown = true;
    console.warn('🔄 Chunk load error detected - app has been updated', error);

    this.zone.run(async () => {
      const alert = await this.alertCtrl.create({
        header: this.i18n.t('errors.chunkUpdate.title'),
        message: this.i18n.t('errors.chunkUpdate.message'),
        backdropDismiss: false,
        buttons: [
          {
            text: this.i18n.t('errors.chunkUpdate.reload'),
            handler: () => {
              if ('caches' in window) {
                caches.keys().then(names => {
                  names.forEach(name => caches.delete(name));
                });
              }
              window.location.reload();
            }
          }
        ]
      });
      await alert.present();
    });
  }
}
