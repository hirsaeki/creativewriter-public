import { inject, Provider, APP_INITIALIZER } from '@angular/core';
import { Router, Route } from '@angular/router';

const languageRoute: Route = {
  path: 'settings/language',
  loadComponent: () =>
    import('../features/language/language.component').then(
      (m) => m.LanguageComponent
    ),
};

function initializeCustomRoutes(): () => void {
  const router = inject(Router);

  return () => {
    const config = [...router.config];

    // Check if route already exists
    const existingIndex = config.findIndex(
      (r) => r.path === 'settings/language'
    );
    if (existingIndex !== -1) {
      return; // Already added
    }

    // Find and remove wildcard route
    const wildcardIndex = config.findIndex((r) => r.path === '**');
    let wildcardRoute: Route | undefined;
    if (wildcardIndex !== -1) {
      wildcardRoute = config.splice(wildcardIndex, 1)[0];
    }

    // Find settings route index (insert before it for proper order)
    const settingsIndex = config.findIndex((r) => r.path === 'settings');

    // Insert language route
    if (settingsIndex !== -1) {
      config.splice(settingsIndex, 0, languageRoute);
    } else {
      config.push(languageRoute);
    }

    // Re-add wildcard at the end
    if (wildcardRoute) {
      config.push(wildcardRoute);
    }

    router.resetConfig(config);
  };
}

export const provideCustomRoutes = (): Provider => ({
  provide: APP_INITIALIZER,
  useFactory: initializeCustomRoutes,
  multi: true,
});
