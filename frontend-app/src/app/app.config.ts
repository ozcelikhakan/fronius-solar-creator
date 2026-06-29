import { ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { provideApollo } from 'apollo-angular';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // eventCoalescing: batches multiple change detection triggers into one — better performance
    provideZoneChangeDetection({ eventCoalescing: true }),

    // withComponentInputBinding: allows route params (:id) to be bound directly as @Input()
    provideRouter(routes, withComponentInputBinding()),

    // HttpClient is required — apollo-angular HttpLink works through it
    provideHttpClient(),

    // Apollo Client — single GraphQL endpoint (api-gateway). GraphQL was preferred
    // so data-heavy pages like the Report page can fetch data with a single query.
    provideApollo(() => {
      const httpLink = inject(HttpLink);

      // The JWT is stored in localStorage by auth.service with the 'fsc_token' key.
      // If it exists, it is added to every GraphQL request as an Authorization header.
      const token = localStorage.getItem('fsc_token');

      return {
        link: httpLink.create({
          uri: environment.graphqlUri,
          headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {})
        }),
        cache: new InMemoryCache()
      };
    })
  ]
};