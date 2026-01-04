import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // Adjust this value in production
  tracesSampleRate: 0.1,
  
  // Set profilesSampleRate to 1.0 to profile every transaction.
  profilesSampleRate: 1.0,
  
  // Only enabled in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Set sampling rate for errors
  sampleRate: 1.0,
  
  // Configure server-specific settings
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    if (event.request?.headers) {
      // Remove sensitive headers
      delete event.request.headers?.authorization;
      delete event.request.headers?.cookie;
    }
    return event;
  },
});
