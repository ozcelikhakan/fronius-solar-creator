import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // eventCoalescing: batches multiple change detection triggers into one — better performance
    provideZoneChangeDetection({ eventCoalescing: true }),

    // withComponentInputBinding: allows route params (:id) to be bound directly as @Input()
    provideRouter(routes, withComponentInputBinding()),

    // HttpClient needed for future Apollo Client and direct API calls
    provideHttpClient()
  ]
};