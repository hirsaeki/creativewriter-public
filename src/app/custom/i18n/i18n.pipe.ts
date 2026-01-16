import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, TranslationKey } from './i18n.service';

@Pipe({
  name: 'cwT',
  standalone: true,
  pure: false,
})
export class I18nPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
