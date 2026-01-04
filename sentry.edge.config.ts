import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  tracesSampleRate: 0.1,
  
  // Only enabled in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Set sampling rate for errors
  sampleRate: 1.0,
  
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
