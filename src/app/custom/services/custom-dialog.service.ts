import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { DialogService, ConfirmOptions, DestructiveConfirmOptions, AlertOptions } from '../../core/services/dialog.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class CustomDialogService extends DialogService {
  private readonly i18n = inject(I18nService);
  private readonly customAlertController = inject(AlertController);

  override async confirm(options: ConfirmOptions): Promise<boolean> {
    return super.confirm({
      ...options,
      cancelText: options.cancelText || this.i18n.t('common.cancel'),
      confirmText: options.confirmText || this.i18n.t('common.confirm'),
    });
  }

  override async confirmDestructive(options: DestructiveConfirmOptions): Promise<boolean> {
    const alert = await this.customAlertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-destructive-dialog',
      buttons: [
        {
          text: this.i18n.t('common.cancel'),
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: options.confirmText || this.i18n.t('common.delete'),
          role: 'confirm',
          cssClass: 'alert-button-danger'
        }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  override async showInfo(options: AlertOptions): Promise<void> {
    return super.showInfo({
      ...options,
      buttonText: options.buttonText || this.i18n.t('common.ok'),
    });
  }

  override async showError(options: AlertOptions): Promise<void> {
    return super.showError({
      ...options,
      buttonText: options.buttonText || this.i18n.t('common.ok'),
    });
  }

  override async showSuccess(options: AlertOptions): Promise<void> {
    return super.showSuccess({
      ...options,
      buttonText: options.buttonText || this.i18n.t('common.ok'),
    });
  }

  override async confirmWarning(options: ConfirmOptions): Promise<boolean> {
    return super.confirmWarning({
      ...options,
      cancelText: options.cancelText || this.i18n.t('common.cancel'),
      confirmText: options.confirmText || this.i18n.t('common.continue'),
    });
  }
}
