import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { defineCustomElements } from '@ionic/core/loader';
import 'hammerjs';

// Initialize Ionic
defineCustomElements(window);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
