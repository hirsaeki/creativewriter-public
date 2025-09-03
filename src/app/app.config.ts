import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app.routes';
import { GlobalErrorHandlerService } from './core/services/global-error-handler.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideIonicAngular({
      // Auto-detect platform: iOS in Safari, MD in Chrome/others
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandlerService }
  ]
};
